-- FAIL-CLOSED rollback candidate for the DRAFT owner self-publish migration.
-- Do not run on hosted DB without schema/grant drift review and a rehearsed rollback.
-- Preserve existing data and private columns. Do NOT restore broad SELECT or published_properties_read.
begin;
revoke execute on function public.set_property_published(uuid,boolean) from authenticated;
revoke execute on function public.confirm_property_contacts(uuid) from authenticated;
drop view if exists public.public_catalog_properties;
drop function if exists public.set_property_published(uuid,boolean);
drop function if exists public.confirm_property_contacts(uuid);
drop trigger if exists contact_origin on public.properties;
drop function if exists public.trg_contact_origin();
-- Keep platform_admins and audit columns intact for investigation and forward recovery.
drop policy if exists published_properties_read on public.properties;
revoke select on public.properties from anon,authenticated;
grant select (id,company_id,name,description,published,contact_phone,contact_email,website_url,owner_revision)
  on public.properties to authenticated;
commit;
