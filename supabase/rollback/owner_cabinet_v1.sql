-- Candidate rollback, manually reviewed on a staging clone first. NOT APPLIED.
-- Keeps columns and private files to avoid destructive data loss.
begin;
revoke update(name,description,contact_phone,contact_email,website_url,published) on public.properties from authenticated;
drop policy if exists owner_update_properties on public.properties;
drop policy if exists owner_read_properties on public.properties;
drop function if exists public.owner_cabinet_version();
drop trigger if exists owner_property_revision on public.properties;
drop function if exists public.owner_property_revision();
revoke select on public.company_members from authenticated;
-- Keep the bucket fail-closed even if unrelated broad policies exist.
drop policy if exists owner_photos_rollback_lock on storage.objects;
create policy owner_photos_rollback_lock on storage.objects as restrictive for all to anon,authenticated
using(bucket_id<>'owner-property-photos') with check(bucket_id<>'owner-property-photos');
drop policy if exists owner_photos_select on storage.objects;
drop policy if exists owner_photos_insert on storage.objects;
drop policy if exists owner_photos_delete on storage.objects;
drop policy if exists owner_photos_select_guard on storage.objects;
drop policy if exists owner_photos_insert_guard on storage.objects;
drop policy if exists owner_photos_delete_guard on storage.objects;
drop policy if exists owner_photos_no_replace on storage.objects;
drop policy if exists owner_photos_no_anon on storage.objects;
drop function if exists public.owner_photo_access(text,boolean);
commit;
-- Disable frontend public config/roll back the frontend separately through review.
-- Do not restore broad INSERT/DELETE/TRUNCATE grants found in the old baseline.
