-- M4 isolated compatibility candidate. Requires M1/M2/M3 and existing legacy tables.
-- Never apply to production without exact-schema rehearsal and separate approval.
begin;
do $$begin if exists(select 1 from public.booking_requests l join widget_private.requests r on r.id=l.id) then raise exception 'request_id_collision';end if;end$$;
alter table public.booking_requests add column revision integer not null default 1;
alter table public.booking_requests add column reservation_id uuid references public.reservations(id);
create index booking_legacy_page on public.booking_requests(property_id,created_at desc,id desc);
alter table widget_private.history add column legacy_request_id uuid references public.booking_requests(id);
create index booking_legacy_history on widget_private.history(legacy_request_id,id);
create table widget_private.legacy_operations(key uuid primary key,request_id uuid not null references public.booking_requests(id),revision integer not null,action text not null,result jsonb not null);
alter table widget_private.legacy_operations enable row level security;
revoke all on widget_private.legacy_operations from public,anon,authenticated;
create function widget_private.guard_request_identity() returns trigger language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.id::text,13));
 if tg_table_schema='public' then
  if exists(select 1 from widget_private.requests where id=new.id) then raise exception 'request_id_collision' using errcode='23505';end if;
 else
  if exists(select 1 from public.booking_requests where id=new.id) then raise exception 'request_id_collision' using errcode='23505';end if;
 end if;return new;
end $$;
revoke all on function widget_private.guard_request_identity() from public,anon,authenticated;
create trigger booking_legacy_identity before insert or update of id on public.booking_requests for each row execute function widget_private.guard_request_identity();
create trigger booking_v2_identity before insert or update of id on widget_private.requests for each row execute function widget_private.guard_request_identity();
-- Preserve original implementations behind the existing API contract.
alter function public.booking_owner_detail(uuid) rename to booking_v3_detail;
alter function public.booking_v3_detail(uuid) set schema widget_private;
alter function public.booking_owner_contacts(uuid) rename to booking_v3_contacts;
alter function public.booking_v3_contacts(uuid) set schema widget_private;
alter function public.booking_owner_transition(uuid,text,integer,uuid) rename to booking_v3_transition;
alter function public.booking_v3_transition(uuid,text,integer,uuid) set schema widget_private;
create view widget_private.owner_feed as
select r.id,r.short_code,r.checkin,r.checkout,r.guests,r.status,r.revision,r.created_at,p.id property_id,p.name property_name,
case when h.status='active' and h.expires_at<=clock_timestamp() then 'expired' else coalesce(h.status,'none') end hold_status,h.expires_at hold_expires_at,
r.status='pending' needs_action,'•••'||right(c.phone,4) masked_contact,'v2'::text generation,false resolution_required
from widget_private.requests r join public.widget_configs w on w.id=r.widget_id join public.properties p on p.id=w.property_id left join widget_private.holds h on h.request_id=r.id left join widget_private.contacts c on c.request_id=r.id
union all
select l.id,'OLD-'||upper(substr(replace(l.id::text,'-',''),1,8)),l.checkin,l.checkout,l.guests,
case l.status when 'new' then 'pending' when 'reviewing' then 'pending' when 'accepted' then 'confirmed' else l.status end,
l.revision,l.created_at,p.id,p.name,'none',null::timestamptz,
l.status in('new','reviewing','accepted'),'•••'||right(c.phone,4),'legacy',l.status='accepted' and l.reservation_id is null
from public.booking_requests l join public.properties p on p.id=l.property_id left join public.booking_guest_contacts c on c.request_id=l.id;
revoke all on widget_private.owner_feed from public,anon,authenticated;
create or replace function public.booking_owner_list(p_property uuid,p_status text default '',p_cursor jsonb default null,p_limit integer default 50,p_q text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb;nextc jsonb;
begin
 perform widget_private.booking_assert_owner(p_property);
 if p_limit is null or p_limit not between 1 and 50 or length(coalesce(p_q,''))>36 then raise exception 'invalid_payload' using errcode='22023';end if;
 if p_cursor is not null then begin perform (p_cursor->>'at')::timestamptz,(p_cursor->>'id')::uuid;if not p_cursor ?& array['at','id'] then raise exception 'invalid';end if;exception when others then raise exception 'invalid_payload' using errcode='22023';end;end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id desc),'[]') into items from(select * from widget_private.owner_feed r where property_id=p_property and (coalesce(p_status,'')='' or status=p_status) and (coalesce(p_q,'')='' or short_code ilike p_q||'%' or checkin::text like p_q||'%') and (p_cursor is null or (created_at,id)<((p_cursor->>'at')::timestamptz,(p_cursor->>'id')::uuid)) order by created_at desc,id desc limit p_limit+1)x;
 if jsonb_array_length(items)>p_limit then items=items-p_limit;nextc=jsonb_build_object('at',items->(p_limit-1)->>'created_at','id',items->(p_limit-1)->>'id');end if;
 return jsonb_build_object('rows',items,'next_cursor',nextc,'counts',(select jsonb_build_object('pending',count(*) filter(where status='pending'),'confirmed',count(*) filter(where status='confirmed'),'closed',count(*) filter(where status in('declined','cancelled'))) from widget_private.owner_feed where property_id=p_property));
end $$;
create function public.booking_owner_detail(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.booking_requests;rowdata jsonb;events jsonb;
begin
 if exists(select 1 from widget_private.requests where id=p_id) then return widget_private.booking_v3_detail(p_id)||jsonb_build_object('generation','v2');end if;
 select * into r from public.booking_requests where id=p_id;perform widget_private.booking_assert_owner(r.property_id);
 select to_jsonb(f)-'masked_contact' into rowdata from widget_private.owner_feed f where id=p_id and generation='legacy';
 select jsonb_build_array(jsonb_build_object('at',r.created_at,'action','legacy_created'))||coalesce(jsonb_agg(jsonb_build_object('at',at,'action',action) order by id),'[]') into events from widget_private.history where legacy_request_id=p_id;
 return rowdata||jsonb_build_object('source_status',r.status,'history',events);
end $$;
create function public.booking_owner_contacts(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare prop uuid;c public.booking_guest_contacts;
begin
 if exists(select 1 from widget_private.requests where id=p_id) then return widget_private.booking_v3_contacts(p_id);end if;
 select property_id into prop from public.booking_requests where id=p_id;perform widget_private.booking_assert_owner(prop);
 if not public.widget_v2_rate_limit('reveal:'||auth.uid(),120,60) then raise exception 'rate_limited' using errcode='P0001';end if;
 select * into c from public.booking_guest_contacts where request_id=p_id;insert into widget_private.history(legacy_request_id,actor,action) values(p_id,auth.uid(),'contacts_viewed');
 return jsonb_build_object('name',c.guest_name,'phone',c.phone,'email',c.email,'comment',c.guest_comment);
end $$;
create function public.booking_owner_transition(p_id uuid,p_action text,p_revision integer,p_key uuid) returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare r public.booking_requests;op widget_private.legacy_operations;rid uuid;result jsonb;
begin
 if exists(select 1 from widget_private.requests where id=p_id) then return widget_private.booking_v3_transition(p_id,p_action,p_revision,p_key);end if;
 select * into r from public.booking_requests where id=p_id;perform widget_private.booking_assert_owner(r.property_id);
 if not widget_private.ledger_ready() then raise exception 'not_ready' using errcode='P0001';end if;
 if p_key is null or p_action is null or p_action not in('confirm','decline','cancel') then raise exception 'invalid_payload' using errcode='22023';end if;
 if not public.widget_v2_rate_limit('transition:'||auth.uid(),120,60) then raise exception 'rate_limited' using errcode='P0001';end if;
 perform pg_catalog.pg_advisory_xact_lock(739251,1);perform widget_private.lock_unit_resources(r.unit_id);perform widget_private.expire_locked();
 select * into r from public.booking_requests where id=p_id for update;
 select * into op from widget_private.legacy_operations where key=p_key;
 if found then if op.request_id<>p_id or op.revision<>p_revision or op.action<>p_action then raise exception 'idempotency_conflict' using errcode='23505';end if;return op.result;end if;
 if r.revision is distinct from p_revision then raise exception 'revision_conflict' using errcode='40001';end if;
 if (p_action in('confirm','decline') and r.status not in('new','reviewing')) or(p_action='cancel' and r.status<>'accepted') then raise exception 'invalid_transition' using errcode='22023';end if;
 if p_action='confirm' then
  if not exists(select 1 from public.unit_resource_requirements where unit_id=r.unit_id) then raise exception 'inventory_unavailable' using errcode='55000';end if;
  if exists(select 1 from widget_private.inventory_blocks(r.unit_id,r.checkin,r.checkout)) then raise exception 'dates_unavailable' using errcode='23P01';end if;
  insert into public.reservations(unit_id,checkin,checkout,status,idempotency_key) values(r.unit_id,r.checkin,r.checkout,'confirmed','legacy-request:'||r.id) returning id into rid;
  update public.booking_requests set status='accepted',reservation_id=rid,revision=revision+1 where id=p_id;
 elsif p_action='decline' then update public.booking_requests set status='declined',revision=revision+1 where id=p_id;
 else
  if r.reservation_id is null then raise exception 'legacy_resolution_required' using errcode='P0001';end if;
  update public.reservations set status='cancelled' where id=r.reservation_id;
  update public.booking_requests set status='cancelled',revision=revision+1 where id=p_id;
 end if;
 insert into widget_private.history(legacy_request_id,actor,action) values(p_id,auth.uid(),p_action);
 result=jsonb_build_object('id',p_id,'status',case p_action when 'confirm' then 'confirmed' when 'decline' then 'declined' else 'cancelled' end);
 insert into widget_private.legacy_operations values(p_key,p_id,p_revision,p_action,result);return result;
end $$;
revoke all on function public.booking_owner_detail(uuid),public.booking_owner_contacts(uuid),public.booking_owner_transition(uuid,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.booking_owner_detail(uuid),public.booking_owner_contacts(uuid),public.booking_owner_transition(uuid,text,integer,uuid) to authenticated;
alter function public.booking_owner_calendar(uuid,text) rename to booking_v3_calendar;
alter function public.booking_v3_calendar(uuid,text) set schema widget_private;
create function public.booking_owner_calendar(p_property uuid,p_month text) returns jsonb language plpgsql security definer set search_path='' as $$
declare data jsonb;events jsonb;
begin
 data=widget_private.booking_v3_calendar(p_property,p_month);
 select coalesce(jsonb_agg(case when l.id is null then e else e||jsonb_build_object('request_id',l.id) end),'[]') into events
 from jsonb_array_elements(data->'events') e left join public.booking_requests l on l.reservation_id=(e->>'id')::uuid and l.property_id=p_property and e->>'kind'='reservation';
 return jsonb_set(data,'{events}',events);
end $$;
revoke all on function public.booking_owner_calendar(uuid,text) from public,anon,authenticated;
grant execute on function public.booking_owner_calendar(uuid,text) to authenticated;
-- Do not invent a reservation for a pre-existing accepted request without evidence.
-- Those rows stay visible with resolution_required=true and no unsafe action.
commit;
