-- DESIGN CANDIDATE ONLY. NEVER apply to hosted or production Supabase.
-- Required order: Owner Cabinet V1 candidate, Publication Pipeline V1 base candidate,
-- then this integration candidate, with no application traffic between those steps.
-- The preferred final rollout is to remove the unsafe grant/policy from Owner Cabinet
-- before it is ever applied; this file is a fail-closed integration backstop.

begin;

-- Refuse to harden a schema other than the two candidates reviewed on 2026-10-16.
do $preflight$
declare
  missing_columns text;
  unexpected_update_policies text;
  unexpected_update_grants text;
begin
  if to_regclass('public.properties') is null
     or to_regclass('public.company_members') is null
     or to_regclass('public.publication_submissions') is null
     or to_regclass('public.publication_reviewer_roles') is null
     or to_regclass('public.publication_audit_events') is null then
    raise exception 'Publication integration preflight: required tables are absent';
  end if;

  select string_agg(required.column_name, ', ' order by required.column_name)
    into missing_columns
  from (values
    ('properties', 'id'), ('properties', 'company_id'), ('properties', 'source_key'),
    ('properties', 'owner_revision'), ('properties', 'published'),
    ('company_members', 'company_id'), ('company_members', 'user_id'),
    ('company_members', 'member_role'),
    ('publication_submissions', 'id'), ('publication_submissions', 'property_id'),
    ('publication_submissions', 'company_id'), ('publication_submissions', 'source_key'),
    ('publication_submissions', 'base_revision'), ('publication_submissions', 'patch'),
    ('publication_submissions', 'patch_sha256'), ('publication_submissions', 'status'),
    ('publication_submissions', 'submitted_by'), ('publication_submissions', 'submitted_at'),
    ('publication_submissions', 'decided_by'), ('publication_submissions', 'decided_at'),
    ('publication_submissions', 'decision_reason')
  ) as required(table_name, column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = required.table_name
      and c.column_name = required.column_name
  );
  if missing_columns is not null then
    raise exception 'Publication integration preflight: missing columns: %', missing_columns;
  end if;

  if to_regprocedure('auth.uid()') is null
     or to_regprocedure('auth.role()') is null
     or to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'Publication integration preflight: required auth or extensions.digest function is absent';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'properties'
      and policyname = 'owner_update_properties' and cmd = 'UPDATE'
      and permissive = 'PERMISSIVE' and 'authenticated' = any(roles)
  ) then
    raise exception 'Publication integration preflight: expected owner_update_properties policy is absent or changed';
  end if;

  select string_agg(policyname, ', ' order by policyname)
    into unexpected_update_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'properties'
    and cmd in ('UPDATE', 'ALL')
    and roles && array['public', 'anon', 'authenticated']::name[]
    and policyname <> 'owner_update_properties';
  if unexpected_update_policies is not null then
    raise exception 'Publication integration preflight: unexpected properties write policies: %', unexpected_update_policies;
  end if;

  if not exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'properties'
      and grantee = 'authenticated' and privilege_type = 'UPDATE'
      and column_name = 'published'
  ) then
    raise exception 'Publication integration preflight: expected unsafe authenticated published grant is absent or changed';
  end if;

  select string_agg(distinct grantee || '.' || column_name, ', ' order by grantee || '.' || column_name)
    into unexpected_update_grants
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'properties'
    and grantee in ('PUBLIC', 'anon', 'authenticated') and privilege_type = 'UPDATE'
    and not (grantee = 'authenticated' and column_name in
      ('name', 'description', 'contact_phone', 'contact_email', 'website_url', 'published'));
  if unexpected_update_grants is not null then
    raise exception 'Publication integration preflight: unexpected direct properties UPDATE grants: %', unexpected_update_grants;
  end if;
end
$preflight$;

revoke update (name, description, contact_phone, contact_email, website_url, published)
  on public.properties from authenticated;
drop policy owner_update_properties on public.properties;

-- If another direct owner write path survived, abort and roll back this whole migration.
do $post_revoke$
begin
  if exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'properties'
      and grantee in ('PUBLIC', 'anon', 'authenticated') and privilege_type = 'UPDATE'
  ) or exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'properties'
      and cmd in ('UPDATE', 'ALL')
      and roles && array['public', 'anon', 'authenticated']::name[]
  ) then
    raise exception 'Publication integration postcondition: a direct properties write path remains';
  end if;
end
$post_revoke$;

-- Serialize the audit hash head so two transitions cannot fork the chain.
create function public.publication_append_audit_v1(
  p_event_type text,
  p_actor_id uuid,
  p_submission_id uuid,
  p_details jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_previous_hash text;
  v_event_id uuid := pg_catalog.gen_random_uuid();
  v_occurred_at timestamptz := pg_catalog.clock_timestamp();
  v_event_hash text;
begin
  perform pg_catalog.pg_advisory_xact_lock(19088743, 1);
  select event_hash into v_previous_hash
  from public.publication_audit_events
  order by sequence desc limit 1;

  v_event_hash := pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'event_id', v_event_id,
      'event_type', p_event_type,
      'actor_id', p_actor_id,
      'submission_id', p_submission_id,
      'occurred_at', v_occurred_at,
      'details', p_details,
      'previous_event_hash', v_previous_hash
    )::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.publication_audit_events(
    event_id, event_type, actor_id, submission_id, occurred_at, details,
    previous_event_hash, event_hash
  ) values (
    v_event_id, p_event_type, p_actor_id, p_submission_id, v_occurred_at,
    p_details, v_previous_hash, v_event_hash
  );
end
$function$;

-- Defense in depth: even a future privileged transition may not rewrite the
-- submitted identity, ownership, version, patch, hash, author or timestamp.
create function public.publication_submission_immutable_v1() returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.id is distinct from old.id
     or new.property_id is distinct from old.property_id
     or new.company_id is distinct from old.company_id
     or new.source_key is distinct from old.source_key
     or new.base_revision is distinct from old.base_revision
     or new.patch is distinct from old.patch
     or new.patch_sha256 is distinct from old.patch_sha256
     or new.submitted_by is distinct from old.submitted_by
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Submitted fields are immutable' using errcode = '55000';
  end if;
  return new;
end
$function$;

create trigger publication_submission_immutable_v1
before update on public.publication_submissions
for each row execute function public.publication_submission_immutable_v1();

create function public.submit_property_publication_v1(
  p_property_id uuid,
  p_base_revision bigint,
  p_patch jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_property public.properties%rowtype;
  v_submission_id uuid := pg_catalog.gen_random_uuid();
  v_patch_hash text;
begin
  if auth.role() <> 'authenticated' or v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_patch is null or pg_catalog.jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'A non-empty object patch is required' using errcode = '22023';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_object_keys(p_patch) as key
    where key not in ('description', 'contact_phone', 'contact_email', 'website_url')
  ) then
    raise exception 'Patch contains a non-owner-editable publication field' using errcode = '42501';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_each(p_patch) e
    where pg_catalog.jsonb_typeof(e.value) not in ('string', 'null')
  ) then
    raise exception 'Publication field values must be strings or null' using errcode = '22023';
  end if;

  select * into v_property
  from public.properties
  where id = p_property_id
  for update;
  if not found then
    raise exception 'Unknown property' using errcode = 'P0002';
  end if;
  if v_property.owner_revision::bigint <> p_base_revision then
    raise exception 'Stale property revision' using errcode = '40001';
  end if;
  if not exists (
    select 1 from public.company_members cm
    where cm.company_id = v_property.company_id and cm.user_id = v_actor
      and cm.member_role in ('owner', 'admin', 'manager')
  ) then
    raise exception 'Owner membership required' using errcode = '42501';
  end if;

  v_patch_hash := pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(p_patch::text, 'UTF8'), 'sha256'), 'hex');
  insert into public.publication_submissions(
    id, property_id, company_id, source_key, base_revision, patch,
    patch_sha256, status, submitted_by
  ) values (
    v_submission_id, v_property.id, v_property.company_id, v_property.source_key,
    p_base_revision, p_patch, v_patch_hash, 'pending', v_actor
  );
  perform public.publication_append_audit_v1(
    'submission.created', v_actor, v_submission_id,
    pg_catalog.jsonb_build_object('property_id', p_property_id,
      'base_revision', p_base_revision, 'patch_sha256', v_patch_hash)
  );
  return v_submission_id;
end
$function$;

create function public.review_property_publication_v1(
  p_submission_id uuid,
  p_decision text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_submission public.publication_submissions%rowtype;
  v_current_revision bigint;
begin
  if auth.role() <> 'authenticated' or v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;
  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) = 0 then
    raise exception 'Review reason is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.publication_reviewer_roles rr
    where rr.user_id = v_actor and rr.role in ('reviewer', 'publisher', 'admin')
  ) then
    raise exception 'Reviewer role required' using errcode = '42501';
  end if;

  select * into v_submission
  from public.publication_submissions
  where id = p_submission_id
  for update;
  if not found then
    raise exception 'Unknown submission' using errcode = 'P0002';
  end if;
  if v_submission.status <> 'pending' then
    raise exception 'Submission is not pending' using errcode = '55000';
  end if;
  if v_submission.submitted_by = v_actor then
    raise exception 'Reviewer cannot review their own submission' using errcode = '42501';
  end if;

  select owner_revision::bigint into v_current_revision
  from public.properties
  where id = v_submission.property_id
  for update;
  if not found or v_current_revision <> v_submission.base_revision then
    raise exception 'Submission is stale' using errcode = '40001';
  end if;

  update public.publication_submissions
  set status = p_decision, decided_by = v_actor, decided_at = pg_catalog.clock_timestamp(),
      decision_reason = pg_catalog.btrim(p_reason)
  where id = p_submission_id;
  perform public.publication_append_audit_v1(
    'submission.' || p_decision, v_actor, p_submission_id,
    pg_catalog.jsonb_build_object('reason', pg_catalog.btrim(p_reason))
  );
end
$function$;

revoke all on function public.publication_append_audit_v1(text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.publication_submission_immutable_v1() from public, anon, authenticated;
revoke all on function public.submit_property_publication_v1(uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.review_property_publication_v1(uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_property_publication_v1(uuid, bigint, jsonb) to authenticated;
grant execute on function public.review_property_publication_v1(uuid, text, text) to authenticated;

commit;

-- Rollback strategy (manual, maintenance window only): revoke EXECUTE on both public
-- RPCs first and leave direct properties UPDATE revoked. Drop the three functions only
-- after confirming no client depends on them; drop the immutable trigger/function only
-- after all transition functions are gone. Do not recreate owner_update_properties
-- or its column grants: that would restore the P0 bypass. Restoring direct writes is a
-- separate security decision, not rollback of this integration.
