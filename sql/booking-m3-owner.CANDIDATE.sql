-- Isolated M3 candidate. Requires M1 + M2; no production application authorized.
begin;
create table widget_private.block_operations(key uuid primary key,actor uuid not null,unit_id uuid not null,starts_on date not null,ends_on date not null,block_id uuid not null references public.unit_blocks(id));
alter table widget_private.block_operations enable row level security;
revoke all on widget_private.block_operations from public,anon,authenticated;
create function public.booking_owner_block(p_unit uuid,p_start date,p_end date,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare prop uuid;old widget_private.block_operations;bid uuid;
begin
 select property_id into prop from public.physical_units where id=p_unit and active;perform widget_private.booking_assert_owner(prop);
 if not widget_private.ledger_ready() then raise exception 'not_ready' using errcode='P0001';end if;
 if p_key is null or p_start is null or p_end is null or p_end<=p_start or p_end-p_start>365 then raise exception 'invalid_payload' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(739251,1);perform widget_private.lock_unit_resources(p_unit);perform widget_private.expire_locked();
 select * into old from widget_private.block_operations where key=p_key;
 if found then
  if old.actor<>auth.uid() or old.unit_id<>p_unit or old.starts_on<>p_start or old.ends_on<>p_end then raise exception 'idempotency_conflict' using errcode='P0001';end if;
  return jsonb_build_object('id',old.block_id);
 end if;
 if exists(select 1 from widget_private.inventory_blocks(p_unit,p_start,p_end)) then raise exception 'dates_unavailable' using errcode='23P01';end if;
 insert into public.unit_blocks(unit_id,starts_on,ends_on,reason) values(p_unit,p_start,p_end,'Owner manual block') returning id into bid;
 insert into widget_private.block_operations values(p_key,auth.uid(),p_unit,p_start,p_end,bid);
 insert into widget_private.history(block_id,actor,action) values(bid,auth.uid(),'block_created');
 return jsonb_build_object('id',bid);
end $$;
revoke all on function public.booking_owner_block(uuid,date,date,uuid) from public,anon,authenticated;
grant execute on function public.booking_owner_block(uuid,date,date,uuid) to authenticated;
create or replace function public.booking_owner_calendar(p_property uuid,p_month text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d date;events jsonb;
begin
 perform widget_private.booking_assert_owner(p_property);
 begin if p_month is null or p_month !~ '^\d{4}-\d{2}$' then raise exception 'invalid';end if;d=(p_month||'-01')::date;exception when others then raise exception 'invalid_payload' using errcode='22023';end;
 -- One logical event per related unit, not one per allocation/resource. Fallback
 -- prevents missing-allocation drift from being displayed as free in the owner UI.
 with occupancy as(
 select distinct u.id unit_id,(a.starts_at at time zone 'UTC')::date starts_on,(a.ends_at at time zone 'UTC')::date ends_on,
 case when a.widget_hold_id is not null then 'hold' when a.allocation_kind='block' then 'block' when a.external_ref is not null then 'external' else 'reservation' end kind,
 coalesce(a.widget_hold_id,a.reservation_id,a.block_id,a.id) id,a.block_id,coalesce(h.request_id,q.id) request_id,
 case when a.external_ref is not null then 'Внешний источник в Supabase' else 'Supabase' end source
 from public.inventory_allocations a join public.unit_resource_requirements m on m.resource_id=a.resource_id join public.physical_units u on u.id=m.unit_id left join widget_private.holds h on h.id=a.widget_hold_id left join widget_private.requests q on q.reservation_id=a.reservation_id
 where u.property_id=p_property and (h.id is null or(h.status='active' and h.expires_at>clock_timestamp()))
 union
 select distinct wanted.unit_id,r.checkin,r.checkout,'reservation',r.id,null::uuid,q.id,'Supabase'
 from public.reservations r join public.unit_resource_requirements other on other.unit_id=r.unit_id join public.unit_resource_requirements wanted on wanted.resource_id=other.resource_id join public.physical_units u on u.id=wanted.unit_id left join widget_private.requests q on q.reservation_id=r.id
 where u.property_id=p_property and r.status in('pending','confirmed') and not exists(select 1 from public.inventory_allocations a where a.reservation_id=r.id)
 union
 select distinct wanted.unit_id,b.starts_on,b.ends_on,'block',b.id,b.id,null::uuid,'Supabase'
 from public.unit_blocks b join public.unit_resource_requirements other on other.unit_id=b.unit_id join public.unit_resource_requirements wanted on wanted.resource_id=other.resource_id join public.physical_units u on u.id=wanted.unit_id
 where u.property_id=p_property and b.released_at is null and not exists(select 1 from public.inventory_allocations a where a.block_id=b.id))
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into events from(select distinct * from occupancy where starts_on<(d+interval '1 month')::date and ends_on>d)x;
 return jsonb_build_object('events',events,'complete',false,'units',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',unit_code) order by unit_code),'[]') from public.physical_units where property_id=p_property and active));
end $$;
alter function public.booking_owner_block(uuid,date,date,uuid) set lock_timeout='2s';
commit;
