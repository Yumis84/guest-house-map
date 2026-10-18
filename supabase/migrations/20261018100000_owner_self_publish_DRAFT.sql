-- DRAFT ONLY. NOT FOR PRODUCTION. Requires live schema/RLS drift review and security sign-off.
-- Source: Claude HANDOFF 66a2f1d1; local PG16 tests are not hosted verification.
begin;
alter table public.properties
  add column if not exists contact_confirmed_at timestamptz,
  add column if not exists published_by uuid,
  add column if not exists published_at timestamptz;
create table if not exists public.platform_admins(user_id uuid primary key references auth.users(id));
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated, public;
drop policy if exists published_properties_read on public.properties;
revoke select on public.properties from anon, authenticated;
grant select (id,company_id,name,description,published,contact_phone,contact_email,website_url,owner_revision,contact_confirmed_at,published_at) on public.properties to authenticated;
create or replace function public.trg_contact_origin() returns trigger language plpgsql set search_path='' as $$
begin
  if (new.contact_phone is distinct from old.contact_phone or new.contact_email is distinct from old.contact_email) and (select auth.uid()) is not null then
    new.contact_confirmed_at := case when coalesce(new.contact_phone,new.contact_email) is null then null else now() end;
  end if;
  return new;
end $$;
drop trigger if exists contact_origin on public.properties;
create trigger contact_origin before update on public.properties for each row execute function public.trg_contact_origin();
create or replace view public.public_catalog_properties with (security_barrier=true) as
select p.id,p.name,p.locality,p.description,p.website_url,
  case when p.contact_confirmed_at is not null then p.contact_phone end as contact_phone,
  case when p.contact_confirmed_at is not null then p.contact_email end as contact_email
from public.properties p where p.published is true;
revoke all on public.public_catalog_properties from public;
grant select on public.public_catalog_properties to anon, authenticated;
create or replace function public.set_property_published(p_property uuid, p_published boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_company uuid; v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'auth required' using errcode='42501'; end if;
  select company_id into v_company from public.properties where id=p_property;
  if v_company is null then raise exception 'unknown property' using errcode='22023'; end if;
  if not (exists(select 1 from public.platform_admins where user_id=v_uid)
       or exists(select 1 from public.company_members where company_id=v_company and user_id=v_uid and member_role in ('owner','admin'))) then
    raise exception 'not allowed' using errcode='42501';
  end if;
  if p_published and not exists(select 1 from public.platform_admins where user_id=v_uid)
     and not exists(select 1 from public.properties where id=p_property and length(btrim(name))>0 and length(btrim(locality))>0) then
    raise exception 'incomplete property' using errcode='23514';
  end if;
  update public.properties set published=p_published,
     published_by=case when p_published then v_uid else published_by end,
     published_at=case when p_published then now() else published_at end where id=p_property;
end $$;
revoke all on function public.set_property_published(uuid,boolean) from public, anon;
grant execute on function public.set_property_published(uuid,boolean) to authenticated;
create or replace function public.confirm_property_contacts(p_property uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_company uuid; v_uid uuid := (select auth.uid());
begin
  select company_id into v_company from public.properties where id=p_property;
  if v_uid is null or v_company is null or not exists(select 1 from public.company_members where company_id=v_company and user_id=v_uid and member_role in ('owner','admin')) then
    raise exception 'not allowed' using errcode='42501';
  end if;
  update public.properties set contact_confirmed_at=now() where id=p_property and (contact_phone is not null or contact_email is not null);
end $$;
revoke all on function public.confirm_property_contacts(uuid) from public, anon;
grant execute on function public.confirm_property_contacts(uuid) to authenticated;
-- Expose v2 only after all required RPCs and column grants have been installed in this transaction.
create or replace function public.owner_cabinet_version() returns integer
language sql stable security invoker set search_path='' as $$ select 2 $$;
revoke all on function public.owner_cabinet_version() from public,anon;
grant execute on function public.owner_cabinet_version() to authenticated;
commit;
