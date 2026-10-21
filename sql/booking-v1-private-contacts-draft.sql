-- Booking V1: private contact data, pending request lifecycle.
-- DRAFT ONLY. Apply after review of existing constraints, RPC and Edge Function.
-- Public/anon must never receive direct table access.
begin;
create table if not exists public.booking_request_contacts (
  request_id uuid primary key references public.booking_requests(id) on delete cascade,
  guest_name text not null check (char_length(trim(guest_name)) between 1 and 120),
  guest_phone text not null check (char_length(guest_phone) between 7 and 30),
  guest_note text check (char_length(guest_note) <= 1000),
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.booking_request_contacts enable row level security;
revoke all on public.booking_request_contacts from anon,authenticated;
-- Owner access only, for authenticated users who belong to the property's company.
create policy booking_contacts_owner_read
on public.booking_request_contacts for select to authenticated
using (exists (
  select 1 from public.booking_requests r
  join public.properties p on p.id=r.property_id
  join public.company_members cm on cm.company_id=p.company_id
  where r.id=booking_request_contacts.request_id
    and cm.user_id=(select auth.uid())
));
grant select on public.booking_request_contacts to authenticated;
-- Do not grant client INSERT/UPDATE/DELETE. Creation via server-side function only.
-- Ensure booking_requests owner SELECT RLS before exposing owner inbox.
-- Pending expiry and transactional conflicts must be implemented in server logic.
commit;
