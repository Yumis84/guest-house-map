-- CANDIDATE ONLY. Not a migration and never automatically applied.
-- Requires existing properties(id, company_id, published), physical_units(id,
-- property_id, active, unit_code), company_members(company_id,user_id,member_role).
-- No legacy functions/tables/policies are replaced.
begin;
create schema widget_private;
revoke all on schema widget_private from public,anon,authenticated;

create function public.widget_v2_valid_config(c jsonb) returns boolean
language sql immutable set search_path='' as $$
select coalesce(jsonb_typeof(c)='object'
  and c ?& array['template','theme','accent','radius','maxWidth','fluid','title','language','buttonText','opening','policyUrl']
  and (c - array['template','theme','accent','radius','maxWidth','fluid','title','language','buttonText','opening','policyUrl'])='{}'::jsonb
  and c->>'template' in ('calendar','button','link') and c->>'theme' in ('light','dark')
  and c->>'accent' ~ '^#[0-9a-fA-F]{6}$'
  and c->'radius' in ('0'::jsonb,'12'::jsonb,'24'::jsonb)
  and jsonb_typeof(c->'maxWidth')='number' and c->>'maxWidth' ~ '^[0-9]{3}$'
  and (c->>'maxWidth')::int between 320 and 900
  and jsonb_typeof(c->'fluid')='boolean'
  and jsonb_typeof(c->'title')='string' and length(trim(c->>'title')) between 1 and 100
  and c->>'language' in ('ru','en')
  and jsonb_typeof(c->'buttonText')='string' and length(trim(c->>'buttonText')) between 1 and 60
  and c->>'opening' in ('inline','modal','newtab')
  and jsonb_typeof(c->'policyUrl')='string' and length(c->>'policyUrl')<=2048
  and (c->>'policyUrl'='' or c->>'policyUrl' ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'),false)
$$;
revoke all on function public.widget_v2_valid_config(jsonb) from public;
grant execute on function public.widget_v2_valid_config(jsonb) to authenticated;

create table public.widget_configs (
 id uuid primary key default gen_random_uuid(),
 public_id text unique not null default replace(gen_random_uuid()::text,'-',''),
 property_id uuid not null references public.properties(id),
 unit_id uuid not null references public.physical_units(id),
 name text not null check(length(trim(name)) between 1 and 100),
 draft jsonb not null check(public.widget_v2_valid_config(draft)),
 published jsonb check(published is null or public.widget_v2_valid_config(published)),
 previous_published jsonb,
 revision integer not null default 1,
 published_revision integer,
 published_version integer not null default 0,
 updated_at timestamptz not null default now(),
 check(public_id ~ '^[a-f0-9]{32}$')
);
alter table public.widget_configs enable row level security;
create policy widget_owner_read on public.widget_configs for select to authenticated using (
 exists(select 1 from public.properties p join public.company_members m on m.company_id=p.company_id
 where p.id=widget_configs.property_id and m.user_id=(select auth.uid()) and m.member_role in ('owner','admin'))
);
revoke all on public.widget_configs from public,anon,authenticated;
grant select on public.widget_configs to authenticated;

create function widget_private.assert_owner(p_property uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.properties p
 join public.company_members m on m.company_id=p.company_id
 where p.id=p_property and m.user_id=auth.uid() and m.member_role in ('owner','admin')) then
 raise exception 'not_authorized' using errcode='42501';end if;
end $$;

create function public.widget_v2_save(p_id uuid,p_property uuid,p_unit uuid,p_name text,p_config jsonb,p_revision integer)
returns public.widget_configs language plpgsql security definer set search_path='' as $$
declare w public.widget_configs;
begin
 perform widget_private.assert_owner(p_property);
 if not exists(select 1 from public.physical_units where id=p_unit and property_id=p_property and active) then
 raise exception 'invalid_unit';end if;
 if p_id is null then
 insert into public.widget_configs(property_id,unit_id,name,draft) values(p_property,p_unit,p_name,p_config) returning * into w;
 else
 select * into w from public.widget_configs where id=p_id for update;
 if not found then raise exception 'not_found';end if;
 perform widget_private.assert_owner(w.property_id);
 -- Keep binding stable. Duplicate/create to select another object or unit.
 if w.property_id<>p_property or w.unit_id<>p_unit then raise exception 'binding_immutable';end if;
 if w.revision<>p_revision then raise exception 'revision_conflict' using errcode='40001';end if;
 update public.widget_configs set name=p_name,draft=p_config,revision=revision+1,updated_at=now()
 where id=p_id returning * into w;
 end if;
 return w;
end $$;

create function public.widget_v2_publish(p_id uuid,p_revision integer) returns public.widget_configs
language plpgsql security definer set search_path='' as $$
declare w public.widget_configs;
begin
 select * into w from public.widget_configs where id=p_id for update;
 if not found then raise exception 'not_found';end if;
 perform widget_private.assert_owner(w.property_id);
 if w.revision<>p_revision then raise exception 'revision_conflict' using errcode='40001';end if;
 if not exists(select 1 from public.properties where id=w.property_id and published)
 or not exists(select 1 from public.physical_units where id=w.unit_id and property_id=w.property_id and active)
 then raise exception 'property_not_published';end if;
 update public.widget_configs set previous_published=published,published=draft,published_revision=revision,
 published_version=published_version+1,updated_at=now() where id=p_id returning * into w;
 return w;
end $$;

create function public.widget_v2_remove(p_id uuid,p_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare w public.widget_configs;
begin
 select * into w from public.widget_configs where id=p_id for update;
 if not found then raise exception 'not_found';end if;
 perform widget_private.assert_owner(w.property_id);
 if w.revision<>p_revision then raise exception 'revision_conflict' using errcode='40001';end if;
 delete from public.widget_configs where id=p_id;
end $$;

-- Read-only public contract: no internal name, owner/company/property/unit IDs or PII.
create function public.widget_v2_config(p_widget text) returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object('publicId',w.public_id,'version',w.published_version,'config',w.published)
from public.widget_configs w join public.properties p on p.id=w.property_id
join public.physical_units u on u.id=w.unit_id and u.property_id=w.property_id
where w.public_id=p_widget and w.published is not null and p.published and u.active
$$;
revoke all on all functions in schema widget_private from public,anon,authenticated;
revoke all on function public.widget_v2_save(uuid,uuid,uuid,text,jsonb,integer),
 public.widget_v2_publish(uuid,integer), public.widget_v2_remove(uuid,integer),public.widget_v2_config(text) from public,anon,authenticated;
grant execute on function public.widget_v2_save(uuid,uuid,uuid,text,jsonb,integer),
 public.widget_v2_publish(uuid,integer),public.widget_v2_remove(uuid,integer) to authenticated;
grant execute on function public.widget_v2_config(text) to anon,authenticated;
commit;
