-- Only synthetic structural counterpart of the read-only live legacy schema.
alter table public.properties add column source_key text;
create table public.booking_requests(id uuid primary key default gen_random_uuid(),property_id uuid not null references public.properties(id),unit_id uuid not null references public.physical_units(id),checkin date not null,checkout date not null,guests integer not null check(guests>0),status text not null default 'new' check(status in('new','reviewing','accepted','declined','cancelled')),source text not null default 'synthetic',idempotency_key text unique,created_at timestamptz not null default clock_timestamp(),check(checkout>checkin));
create table public.booking_guest_contacts(request_id uuid primary key references public.booking_requests(id) on delete cascade,guest_name text not null,phone text not null,email text,guest_comment text,created_at timestamptz not null default clock_timestamp());
alter table public.booking_requests enable row level security;alter table public.booking_guest_contacts enable row level security;
revoke all on public.booking_guest_contacts from public,anon,authenticated;
alter table public.unit_blocks enable row level security;
grant select,insert,delete on public.unit_blocks to authenticated;
create policy synthetic_owner_blocks on public.unit_blocks for all to authenticated using(exists(select 1 from public.physical_units u where u.id=unit_id)) with check(exists(select 1 from public.physical_units u where u.id=unit_id));
create function public.submit_stepan_booking(p_checkin date,p_checkout date,p_guests integer,p_name text,p_phone text,p_email text,p_comment text) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 insert into public.booking_requests(property_id,unit_id,checkin,checkout,guests,source) select property_id,id,p_checkin,p_checkout,p_guests,'synthetic-legacy' from public.physical_units where unit_code='STEPAN-HOUSE' returning id into rid;
 insert into public.booking_guest_contacts(request_id,guest_name,phone,email,guest_comment) values(rid,p_name,p_phone,p_email,p_comment);return rid;
end $$;
grant execute on function public.submit_stepan_booking(date,date,integer,text,text,text,text) to anon,authenticated;
