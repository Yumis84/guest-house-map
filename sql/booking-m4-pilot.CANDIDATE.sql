-- Separate, disabled-by-default pilot gate. Only apply to an isolated rehearsal.
begin;
create table widget_private.pilots(property_id uuid primary key references public.properties(id),state text not null check(state in('prepared','active','paused')),changed_at timestamptz not null default clock_timestamp());
alter table widget_private.pilots enable row level security;
revoke all on widget_private.pilots from public,anon,authenticated;
create function public.booking_pilot_enabled(p_unit uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare prop uuid;begin
 select property_id into prop from public.physical_units where id=p_unit;if current_setting('role',true)<>'service_role' then perform widget_private.booking_assert_owner(prop);end if;
 return exists(select 1 from widget_private.pilots where property_id=prop and state in('active','paused'));
end $$;
revoke all on function public.booking_pilot_enabled(uuid) from public,anon,authenticated;
grant execute on function public.booking_pilot_enabled(uuid) to authenticated,service_role;
-- SECURITY INVOKER is intentional: direct API role is visible; a reviewed
-- SECURITY DEFINER booking RPC runs as its owner and may perform the write.
create function widget_private.guard_pilot_dml() returns trigger language plpgsql security invoker set search_path='' as $$
declare unit uuid;begin
 if tg_op='DELETE' then unit=old.unit_id;else unit=new.unit_id;end if;
 if current_user in('anon','authenticated','service_role') and public.booking_pilot_enabled(unit) then raise exception 'use_booking_rpc' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function widget_private.guard_pilot_dml() from public,anon,authenticated;
create trigger booking_m4_block_guard before insert or update or delete on public.unit_blocks for each row execute function widget_private.guard_pilot_dml();
create trigger booking_m4_reservation_guard before insert or update or delete on public.reservations for each row execute function widget_private.guard_pilot_dml();
create trigger booking_m4_legacy_guard before update or delete on public.booking_requests for each row execute function widget_private.guard_pilot_dml();
alter function public.submit_stepan_booking(date,date,integer,text,text,text,text) rename to booking_legacy_submit_original;
alter function public.booking_legacy_submit_original(date,date,integer,text,text,text,text) set schema widget_private;
create function public.submit_stepan_booking(p_checkin date,p_checkout date,p_guests integer,p_name text,p_phone text,p_email text,p_comment text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from widget_private.pilots x join public.properties p on p.id=x.property_id where p.source_key='house_001' and x.state in('active','paused')) then raise exception 'booking_channel_switched' using errcode='55000';end if;
 return widget_private.booking_legacy_submit_original(p_checkin,p_checkout,p_guests,p_name,p_phone,p_email,p_comment);
end $$;
revoke all on function public.submit_stepan_booking(date,date,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_stepan_booking(date,date,integer,text,text,text,text) to anon,authenticated;
create function public.booking_pilot_set(p_property uuid,p_state text) returns void language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
begin
 if p_state is null or p_state not in('prepared','active','paused') or not exists(select 1 from public.properties where id=p_property and source_key='house_001') then raise exception 'invalid_pilot' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(739251,1);
 if p_state='active' then
  if not widget_private.ledger_ready() or (select count(*) from public.physical_units where property_id=p_property and active)<>1 or not exists(select 1 from public.physical_units u join widget_private.activation a on a.unit_id=u.id where u.property_id=p_property and u.unit_code='STEPAN-HOUSE' and a.inventory_verified and a.hold_minutes=15 and exists(select 1 from public.unit_resource_requirements where unit_id=u.id)) then raise exception 'inventory_unavailable' using errcode='55000';end if;
  if exists(select 1 from public.booking_requests where property_id=p_property and status='accepted' and reservation_id is null) then raise exception 'legacy_resolution_required' using errcode='P0001';end if;
 end if;
 -- A pause never restores the legacy unguarded route. No active->prepared shortcut.
 if p_state='prepared' and exists(select 1 from widget_private.pilots where property_id=p_property and state in('active','paused')) then raise exception 'invalid_transition' using errcode='22023';end if;
 insert into widget_private.pilots(property_id,state) values(p_property,p_state) on conflict(property_id) do update set state=excluded.state,changed_at=clock_timestamp();
 update widget_private.activation a set enabled=p_state='active' from public.physical_units u where a.unit_id=u.id and u.property_id=p_property;
end $$;
revoke all on function public.booking_pilot_set(uuid,text) from public,anon,authenticated;
grant execute on function public.booking_pilot_set(uuid,text) to service_role;
commit;
