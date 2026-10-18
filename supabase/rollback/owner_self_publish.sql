-- Candidate rollback for owner self-publish DRAFT. Restores earlier insecure published read policy.
-- SANDBOX ONLY: do not run in hosted production without a revised security-safe rollback plan.
begin;
drop view if exists public.public_catalog_properties;
drop function if exists public.set_property_published(uuid,boolean);
drop function if exists public.confirm_property_contacts(uuid);
drop trigger if exists contact_origin on public.properties;
drop function if exists public.trg_contact_origin();
drop table if exists public.platform_admins;
revoke select on public.properties from authenticated;
grant select on public.properties to authenticated;
drop policy if exists published_properties_read on public.properties;
create policy published_properties_read on public.properties for select to anon,authenticated using(published);
commit;
