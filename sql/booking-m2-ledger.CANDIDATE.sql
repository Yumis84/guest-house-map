-- CANDIDATE M2 ONLY. Requires booking-m1-lifecycle candidate. Never apply to production.
begin;
create or replace function widget_private.expire_locked() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 delete from public.inventory_allocations a using widget_private.holds h where a.widget_hold_id=h.id and h.status='active' and h.expires_at<=clock_timestamp();
 with changed as(update widget_private.holds set status='expired' where status='active' and expires_at<=clock_timestamp() returning request_id)
 insert into widget_private.history(request_id,action) select request_id,'hold_expired' from changed;
 get diagnostics n=row_count;return n;
end $$;
create or replace function public.booking_expire_holds() returns integer language plpgsql security definer set search_path='' as $$
begin perform pg_catalog.pg_advisory_xact_lock(739251,1);return widget_private.expire_locked();end $$;
create or replace function widget_private.allocation_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin perform pg_catalog.pg_advisory_xact_lock(739251,1);perform widget_private.lock_unit_resources(new.unit_id);perform widget_private.expire_locked();return new;end $$;
create or replace function widget_private.release_block() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(739251,1);
 if new.released_at is not null then delete from public.inventory_allocations where block_id=new.id;end if;return new;
end $$;
create or replace function widget_private.inventory_blocks(p_unit uuid,p_start date,p_end date)
returns table(starts_on date,ends_on date) language sql set search_path='' as $$
 select distinct (a.starts_at at time zone 'UTC')::date,(a.ends_at at time zone 'UTC')::date
 from public.inventory_allocations a join public.unit_resource_requirements r on r.resource_id=a.resource_id
 left join widget_private.holds h on h.id=a.widget_hold_id
 where r.unit_id=p_unit and a.starts_at<(p_end::timestamp at time zone 'UTC') and a.ends_at>(p_start::timestamp at time zone 'UTC')
 and (a.widget_hold_id is null or (h.status='active' and h.expires_at>clock_timestamp()))
 union
 select distinct booked.checkin,booked.checkout from public.reservations booked
 join public.unit_resource_requirements other_map on other_map.unit_id=booked.unit_id
 join public.unit_resource_requirements wanted on wanted.resource_id=other_map.resource_id and wanted.unit_id=p_unit
 where booked.status in ('pending','confirmed') and booked.checkin<p_end and booked.checkout>p_start
 union
 select distinct b.starts_on,b.ends_on from public.unit_blocks b
 join public.unit_resource_requirements other_map on other_map.unit_id=b.unit_id
 join public.unit_resource_requirements wanted on wanted.resource_id=other_map.resource_id and wanted.unit_id=p_unit
 where b.released_at is null and b.starts_on<p_end and b.ends_on>p_start
$$;
create or replace function public.booking_submit(p_widget text,p_payload jsonb,p_idempotency uuid,p_fingerprint text,p_actor text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.widget_configs;a widget_private.activation;r widget_private.requests;h widget_private.holds;d1 date;d2 date;g integer;t timestamptz;held boolean:=false;
begin
 if p_idempotency is null or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or p_actor is null or p_actor !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid_payload' using errcode='22023';end if;
 begin
 if jsonb_typeof(p_payload->'checkin')<>'string' or jsonb_typeof(p_payload->'checkout')<>'string' or p_payload->>'checkin' !~ '^\d{4}-\d{2}-\d{2}$' or p_payload->>'checkout' !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(p_payload->'guests')<>'number' or p_payload->>'guests' !~ '^[0-9]+$' then raise exception 'invalid';end if;
 d1=(p_payload->>'checkin')::date;d2=(p_payload->>'checkout')::date;g=(p_payload->>'guests')::integer;
 exception when others then raise exception 'invalid_payload' using errcode='22023';end;
 if d1 is null or d2 is null or g is null or d2<=d1 or d2-d1>30 or d1<(clock_timestamp() at time zone 'Europe/Kaliningrad')::date or d1>(clock_timestamp() at time zone 'Europe/Kaliningrad')::date+365 or g<1
 or jsonb_typeof(p_payload->'name') is distinct from 'string' or length(trim(p_payload->>'name')) not between 1 and 120
 or coalesce(p_payload->>'phone','') !~ '^\+[1-9][0-9]{6,14}$' or p_payload->'consent' is distinct from 'true'::jsonb
 or jsonb_typeof(p_payload->'comment') is distinct from 'string' or length(p_payload->>'comment')>1000 then raise exception 'invalid_payload' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(739251,1);perform widget_private.expire_locked();
 select * into w from public.widget_configs where public_id=p_widget and archived_at is null for share;
 if not found or public.widget_v2_config(p_widget) is null then raise exception 'widget_unavailable' using errcode='55000';end if;
 perform widget_private.lock_unit_resources(w.unit_id);
 select * into a from widget_private.activation where unit_id=w.unit_id;
 if not found or not a.enabled or not a.inventory_verified or a.hold_minutes is distinct from 15 or coalesce(w.published->>'policyUrl','')='' then raise exception 'not_activated' using errcode='55000';end if;
 if g>a.capacity then raise exception 'invalid_payload' using errcode='22023';end if;
 select * into r from widget_private.requests where widget_id=w.id and idempotency=p_idempotency;
 if found then
 if r.fingerprint<>p_fingerprint then raise exception 'idempotency_conflict' using errcode='23505';end if;
 return jsonb_build_object('accepted',true,'requestId',r.id);end if;
 if (select count(*) from widget_private.holds quota_hold join widget_private.requests x on x.id=quota_hold.request_id join widget_private.contacts c on c.request_id=x.id where quota_hold.status='active' and quota_hold.expires_at>clock_timestamp() and (x.actor_hash=p_actor or c.phone=p_payload->>'phone'))>=2 then raise exception 'hold_limit' using errcode='54000';end if;
 if not exists(select 1 from public.unit_resource_requirements where unit_id=w.unit_id) then raise exception 'inventory_unavailable' using errcode='55000';end if;
 t=clock_timestamp();
 insert into widget_private.requests(widget_id,unit_id,checkin,checkout,guests,expires_at,idempotency,fingerprint,actor_hash)
 values(w.id,w.unit_id,d1,d2,g,t+interval '15 minutes',p_idempotency,p_fingerprint,p_actor) returning * into r;
 insert into widget_private.contacts(request_id,name,phone,comment,policy_url,config_version) values(r.id,trim(p_payload->>'name'),p_payload->>'phone',p_payload->>'comment',w.published->>'policyUrl',w.published_version);
 if not exists(select 1 from widget_private.inventory_blocks(w.unit_id,d1,d2)) then
 insert into widget_private.holds(request_id,status,accepted_at,expires_at) values(r.id,'active',t,t+interval '15 minutes') returning * into h;
 insert into public.inventory_allocations(resource_id,unit_id,starts_at,ends_at,allocation_kind,widget_hold_id)
 select resource_id,w.unit_id,d1::timestamp at time zone 'UTC',d2::timestamp at time zone 'UTC','hold',h.id from public.unit_resource_requirements where unit_id=w.unit_id order by resource_id;
 held=true;end if;
 insert into widget_private.history(request_id,action) values(r.id,case when held then 'request_created_with_hold' else 'request_created_without_hold_conflict' end);
 return jsonb_build_object('accepted',true,'requestId',r.id);
end $$;
create or replace function public.booking_public_availability(p_widget text,p_start date,p_end date) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.widget_configs;a widget_private.activation;blocks jsonb;
begin
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>62 then raise exception 'invalid_payload' using errcode='22023';end if;
 select * into w from public.widget_configs where public_id=p_widget and archived_at is null;
 if not found or public.widget_v2_config(p_widget) is null then return null;end if;
 perform widget_private.lock_unit_resources(w.unit_id);
 select * into a from widget_private.activation where unit_id=w.unit_id;
 if not found or not a.enabled or not a.inventory_verified or a.hold_minutes is distinct from 15 or not exists(select 1 from public.unit_resource_requirements where unit_id=w.unit_id) then return jsonb_build_object('ready',false);end if;
 select coalesce(jsonb_agg(jsonb_build_object('starts_on',starts_on,'ends_on',ends_on)),'[]') into blocks from widget_private.inventory_blocks(w.unit_id,p_start,p_end);
 return jsonb_build_object('ready',true,'capacity',a.capacity,'blocks',blocks);
end $$;
create trigger booking_allocation_guard before insert or update on public.inventory_allocations for each row execute function widget_private.allocation_guard();
create trigger booking_block_release after update of released_at on public.unit_blocks for each row execute function widget_private.release_block();
create or replace function widget_private.ledger_ready() returns boolean language sql set search_path='' as $$select true$$;
revoke all on all functions in schema widget_private from public,anon,authenticated;
commit;
