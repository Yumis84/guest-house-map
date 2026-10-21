-- Owner calendar v1. Review before applying to Supabase.
-- Property: house_001. Private blocks are accessible only to members of the property's company.
-- Public availability exposes dates only, never reason or guest details.
begin;
create policy owner_read_room_types on public.room_types for select to authenticated
using (exists(select 1 from public.properties p join public.company_members cm on cm.company_id=p.company_id where p.id=room_types.property_id and cm.user_id=(select auth.uid())));
create policy owner_read_units on public.physical_units for select to authenticated
using (exists(select 1 from public.properties p join public.company_members cm on cm.company_id=p.company_id where p.id=physical_units.property_id and cm.user_id=(select auth.uid())));
create policy owner_read_blocks on public.unit_blocks for select to authenticated
using (exists(select 1 from public.physical_units u join public.properties p on p.id=u.property_id join public.company_members cm on cm.company_id=p.company_id where u.id=unit_blocks.unit_id and cm.user_id=(select auth.uid())));
create policy owner_insert_blocks on public.unit_blocks for insert to authenticated
with check (exists(select 1 from public.physical_units u join public.properties p on p.id=u.property_id join public.company_members cm on cm.company_id=p.company_id where u.id=unit_blocks.unit_id and cm.user_id=(select auth.uid())));
create policy owner_delete_blocks on public.unit_blocks for delete to authenticated
using (exists(select 1 from public.physical_units u join public.properties p on p.id=u.property_id join public.company_members cm on cm.company_id=p.company_id where u.id=unit_blocks.unit_id and cm.user_id=(select auth.uid())));
-- This RPC intentionally only exposes blocks for explicitly published properties.
create or replace function public.public_calendar_blocks(p_property_id uuid)
returns table(starts_on date,ends_on date)
language sql stable security definer
set search_path = ''
as $$
select b.starts_on,b.ends_on from public.unit_blocks b
join public.physical_units u on u.id=b.unit_id
join public.properties p on p.id=u.property_id
where p.id=p_property_id and p.published=true and u.active=true
$$;
revoke all on function public.public_calendar_blocks(uuid) from public;
grant execute on function public.public_calendar_blocks(uuid) to anon,authenticated;
commit;
