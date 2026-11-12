-- Isolated candidate only. Does not grant access or alter Auth users/memberships.
-- Additive restrictive policy: preserve existing property ownership policy while
-- preventing a lower-privilege member from bypassing the audited contact RPC.
begin;
set local lock_timeout='2s';
create policy booking_m5_contact_roles on public.booking_guest_contacts
as restrictive for select to authenticated
using(exists(
 select 1 from public.booking_requests r
 join public.properties p on p.id=r.property_id
 join public.company_members m on m.company_id=p.company_id
 where r.id=request_id and m.user_id=(select auth.uid())
 and m.member_role in('owner','admin')
));
commit;
