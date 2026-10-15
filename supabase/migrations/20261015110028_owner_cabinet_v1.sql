-- Candidate only. NOT applied to hosted Supabase.
-- Baseline verified by read-only audit of guest-house-booking, 2026-10-15.
begin;
-- Fail rather than silently compose with unexpected permissive table policies.
do $$ begin
  if exists(select 1 from pg_policies where schemaname='public' and
    ((tablename='properties' and policyname<>'published_properties_read') or
     (tablename='company_members' and policyname<>'members_can_read_own_membership'))) then
    raise exception 'Policy drift: review current policies before applying Owner Cabinet V1';
  end if;
end $$;
alter table public.properties enable row level security;
alter table public.company_members enable row level security;
alter table public.properties
  add column contact_phone text,
  add column contact_email text,
  add column website_url text,
  add column owner_revision integer not null default 0;
alter table public.properties
  add constraint owner_name_length check (length(btrim(name)) between 1 and 160) not valid,
  add constraint owner_description_length check (description is null or length(description)<=10000) not valid,
  add constraint owner_contact_phone check (contact_phone is null or contact_phone ~ '^[+0-9 ()-]{5,40}$'),
  add constraint owner_contact_email check (contact_email is null or (length(contact_email)<=254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  add constraint owner_website_url check (website_url is null or (length(website_url)<=2048 and website_url ~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$'));
-- Column grants are deliberate: company_id, id, source_key, revision and inventory cannot be changed.
revoke all on public.properties from anon, authenticated, public;
revoke all on public.company_members from anon, authenticated, public;
grant select on public.properties to anon, authenticated;
grant select on public.company_members to authenticated;
drop policy members_can_read_own_membership on public.company_members;
create policy members_can_read_own_membership on public.company_members for select to authenticated
using(user_id=(select auth.uid()));
drop policy published_properties_read on public.properties;
create policy published_properties_read on public.properties for select to anon,authenticated using(published);
grant update (name,description,contact_phone,contact_email,website_url,published) on public.properties to authenticated;
create policy owner_read_properties on public.properties for select to authenticated
using (exists(select 1 from public.company_members cm where cm.company_id=properties.company_id and cm.user_id=(select auth.uid())));
create policy owner_update_properties on public.properties for update to authenticated
using (exists(select 1 from public.company_members cm where cm.company_id=properties.company_id and cm.user_id=(select auth.uid()) and cm.member_role in ('owner','admin','manager')))
with check (exists(select 1 from public.company_members cm where cm.company_id=properties.company_id and cm.user_id=(select auth.uid()) and cm.member_role in ('owner','admin','manager')));
create function public.owner_property_revision() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  new.owner_revision=old.owner_revision+1;
  return new;
end $$;
revoke all on function public.owner_property_revision() from public,anon,authenticated;
create trigger owner_property_revision before update on public.properties
for each row execute function public.owner_property_revision();
create index if not exists owner_members_user_company_idx on public.company_members(user_id,company_id);
create index if not exists owner_properties_company_idx on public.properties(company_id);

-- Fresh private bucket. A collision is an error, never convert an existing public bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('owner-property-photos','owner-property-photos',false,5242880,array['image/webp']);
-- Invoker rights preserve membership/property RLS. No JWT metadata authorization.
create function public.owner_photo_access(object_name text,write_access boolean)
returns boolean language sql stable security invoker set search_path='' as $$
  select object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
  and exists (
    select 1 from public.properties p join public.company_members cm on cm.company_id=p.company_id
    where p.company_id::text=split_part(object_name,'/',1)
      and p.id::text=split_part(object_name,'/',2)
      and cm.user_id=(select auth.uid())
      and (not write_access or cm.member_role in ('owner','admin','manager'))
  );
$$;
revoke all on function public.owner_photo_access(text,boolean) from public,anon;
grant execute on function public.owner_photo_access(text,boolean) to authenticated;
create policy owner_photos_select on storage.objects for select to authenticated
using(bucket_id='owner-property-photos' and public.owner_photo_access(name,false));
create policy owner_photos_insert on storage.objects for insert to authenticated
with check(bucket_id='owner-property-photos' and public.owner_photo_access(name,true));
create policy owner_photos_delete on storage.objects for delete to authenticated
using(bucket_id='owner-property-photos' and public.owner_photo_access(name,true));
-- Restrictive guards prevent future broad policies from opening this bucket.
create policy owner_photos_select_guard on storage.objects as restrictive for select to authenticated
using(bucket_id<>'owner-property-photos' or public.owner_photo_access(name,false));
create policy owner_photos_insert_guard on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'owner-property-photos' or public.owner_photo_access(name,true));
create policy owner_photos_delete_guard on storage.objects as restrictive for delete to authenticated
using(bucket_id<>'owner-property-photos' or public.owner_photo_access(name,true));
create policy owner_photos_no_replace on storage.objects as restrictive for update to authenticated
using(bucket_id<>'owner-property-photos') with check(bucket_id<>'owner-property-photos');
create policy owner_photos_no_anon on storage.objects as restrictive for all to anon
using(bucket_id<>'owner-property-photos') with check(bucket_id<>'owner-property-photos');
create function public.owner_cabinet_version() returns integer
language sql stable security invoker set search_path='' as $$ select 1 $$;
revoke all on function public.owner_cabinet_version() from public,anon;
grant execute on function public.owner_cabinet_version() to authenticated;
commit;
