-- CANDIDATE M1 ONLY. Ledger stays fail closed until M2. This file Apply only to an isolated synthetic baseline after #23 candidates.
-- Never auto-migrated. Working Supabase/n8n and legacy auth remain unchanged.
begin;
alter table public.widget_configs add column archived_at timestamptz;
alter table public.widget_configs add constraint widget_active_projection check(archived_at is null or published is null);
alter table public.widget_configs add constraint widget_ru_only check(draft->>'language'='ru' and (published is null or published->>'language'='ru'));
alter table widget_private.activation add constraint hold_exact_15 check(hold_minutes is null or hold_minutes=15);
alter table widget_private.requests add column revision integer not null default 1;
alter table widget_private.requests add column reservation_id uuid references public.reservations(id);
alter table widget_private.requests add column actor_hash text;
alter table widget_private.requests add column short_code text not null default ('KR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))) unique;
alter table widget_private.requests add column decided_at timestamptz;
alter table widget_private.requests add column decided_by uuid;
create index booking_requests_page on widget_private.requests(widget_id,status,created_at desc,id desc);
create index booking_requests_all_page on widget_private.requests(widget_id,created_at desc,id desc);
create table widget_private.holds(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique references widget_private.requests(id),
 status text not null check(status in ('active','expired','released','converted')),
 accepted_at timestamptz not null,expires_at timestamptz not null,
 check(expires_at=accepted_at+interval '15 minutes')
);
alter table public.inventory_allocations add column widget_hold_id uuid references widget_private.holds(id);
create index booking_holds_expiry on widget_private.holds(expires_at,request_id) where status='active';
create table widget_private.history(id bigint generated always as identity primary key,request_id uuid references widget_private.requests(id),actor uuid,action text not null,at timestamptz not null default clock_timestamp());
alter table widget_private.history add column block_id uuid references public.unit_blocks(id);
create table widget_private.operations(key uuid primary key,revision integer not null,request_id uuid not null references widget_private.requests(id),action text not null,result jsonb not null);
alter table public.unit_blocks add column released_at timestamptz;
alter table widget_private.holds enable row level security;
alter table widget_private.history enable row level security;
alter table widget_private.operations enable row level security;
revoke all on all tables in schema widget_private from public,anon,authenticated;


create function widget_private.booking_assert_owner(p_property uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform widget_private.assert_owner(p_property);exception when insufficient_privilege then raise exception 'not_found' using errcode='P0001';end $$;
create function widget_private.lock_unit_resources(p_unit uuid) returns void language plpgsql security definer set search_path='' as $$
declare r uuid;begin
 for r in select resource_id from public.unit_resource_requirements where unit_id=p_unit order by resource_id loop perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r::text,0));end loop;
end $$;
create function widget_private.ledger_ready() returns boolean language sql set search_path='' as $$select false$$;


create function widget_private.expire_locked() returns integer language sql set search_path='' as $$select 0$$;
create function public.booking_expire_holds() returns integer language plpgsql security definer set search_path='' as $$begin raise exception 'not_ready' using errcode='P0001';end $$;
create function public.booking_submit(p_widget text,p_payload jsonb,p_idempotency uuid,p_fingerprint text,p_actor text) returns jsonb language plpgsql security definer set search_path='' as $$begin raise exception 'not_ready' using errcode='P0001';end $$;
create function public.booking_public_availability(p_widget text,p_start date,p_end date) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('ready',false)$$;

-- A conservative single booking transaction lock prevents lock-order inversions
-- across unit, parent/child resources, expiry and existing allocation triggers.
-- All allocation INSERTs take it, including reservation/block trigger writes.





-- Preserve existing triggers and soft-release manual blocks by clearing allocations.
-- Candidate adds a trigger for new released_at changes only.







create function public.booking_owner_transition(p_id uuid,p_action text,p_revision integer,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r widget_private.requests;w public.widget_configs;h widget_private.holds;op widget_private.operations;rid uuid;result jsonb;
begin
 if not widget_private.ledger_ready() then raise exception 'not_ready' using errcode='P0001';end if;
 if p_key is null or p_action not in ('confirm','decline','cancel') or p_action is null then raise exception 'invalid_payload' using errcode='22023';end if;
 select * into r from widget_private.requests where id=p_id;
 if not found then raise exception 'not_found' using errcode='P0001';end if;
 select * into w from public.widget_configs where id=r.widget_id;perform widget_private.booking_assert_owner(w.property_id);
 if not public.widget_v2_rate_limit('transition:'||auth.uid(),120,60) then raise exception 'rate_limited' using errcode='P0001';end if;
 perform pg_catalog.pg_advisory_xact_lock(739251,1);perform widget_private.expire_locked();
 perform widget_private.lock_unit_resources(r.unit_id);
 select * into r from widget_private.requests where id=p_id for update;if not found then raise exception 'not_found' using errcode='P0001';end if;
 perform widget_private.lock_unit_resources(r.unit_id);
 select * into w from public.widget_configs where id=r.widget_id;perform widget_private.booking_assert_owner(w.property_id);
 select * into op from widget_private.operations where key=p_key;
 if found then if op.request_id<>p_id or op.action<>p_action or op.revision is distinct from p_revision then raise exception 'idempotency_conflict' using errcode='23505';end if;return op.result;end if;
 if r.revision is distinct from p_revision then raise exception 'revision_conflict' using errcode='40001';end if;
 if (p_action in ('confirm','decline') and r.status<>'pending') or (p_action='cancel' and r.status<>'confirmed') then raise exception 'invalid_transition' using errcode='22023';end if;
 select * into h from widget_private.holds where request_id=r.id for update;
 if p_action='confirm' then
 -- Delete only our own hold; any exception rolls back this release and transition.
 delete from public.inventory_allocations where widget_hold_id=h.id;
 if exists(select 1 from widget_private.inventory_blocks(r.unit_id,r.checkin,r.checkout)) then raise exception 'dates_unavailable' using errcode='23P01';end if;
 if not exists(select 1 from public.unit_resource_requirements where unit_id=r.unit_id) then raise exception 'inventory_unavailable' using errcode='55000';end if;
 insert into public.reservations(unit_id,checkin,checkout,status,idempotency_key) values(r.unit_id,r.checkin,r.checkout,'confirmed','widget-request:'||r.id) returning id into rid;
 update widget_private.holds set status='converted' where id=h.id and status='active';
 update widget_private.requests set status='confirmed',reservation_id=rid,revision=revision+1,decided_at=clock_timestamp(),decided_by=auth.uid() where id=r.id;
 elsif p_action='decline' then
 delete from public.inventory_allocations where widget_hold_id=h.id;
 update widget_private.holds set status='released' where id=h.id and status='active';
 update widget_private.requests set status='declined',revision=revision+1,decided_at=clock_timestamp(),decided_by=auth.uid() where id=r.id;
 else
 update public.reservations set status='cancelled' where id=r.reservation_id;
 update widget_private.requests set status='cancelled',revision=revision+1,decided_at=clock_timestamp(),decided_by=auth.uid() where id=r.id;
 end if;
 insert into widget_private.history(request_id,actor,action) values(r.id,auth.uid(),p_action);
 result=jsonb_build_object('id',r.id,'status',case p_action when 'confirm' then 'confirmed' when 'decline' then 'declined' else 'cancelled' end);
 insert into widget_private.operations values(p_key,p_revision,r.id,p_action,result);return result;
end $$;

create function public.booking_owner_list(p_property uuid,p_status text default '',p_cursor jsonb default null,p_limit integer default 50,p_q text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb;nextc jsonb;
begin
 perform widget_private.booking_assert_owner(p_property);
 if p_limit is null or p_limit not between 1 and 50 or length(coalesce(p_q,''))>36 then raise exception 'invalid_payload' using errcode='22023';end if;
 if p_cursor is not null then begin perform (p_cursor->>'at')::timestamptz,(p_cursor->>'id')::uuid; if not p_cursor ?& array['at','id'] then raise exception 'invalid';end if;exception when others then raise exception 'invalid_payload' using errcode='22023';end;end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]') into items from(
 select r.id,r.short_code,r.checkin,r.checkout,r.guests,r.status,r.revision,r.created_at,p.name as property_name,
 case when h.status='active' and h.expires_at<=clock_timestamp() then 'expired' else coalesce(h.status,'none') end hold_status,h.expires_at as hold_expires_at,
 r.status='pending' needs_action,'•••'||right(c.phone,4) masked_contact
 from widget_private.requests r join public.widget_configs w on w.id=r.widget_id join public.properties p on p.id=w.property_id
 left join widget_private.holds h on h.request_id=r.id left join widget_private.contacts c on c.request_id=r.id
 where w.property_id=p_property and (coalesce(p_status,'')='' or r.status=p_status) and (coalesce(p_q,'')='' or (r.short_code ilike p_q||'%' or r.checkin::text like p_q||'%'))
 and (p_cursor is null or (r.created_at,r.id)<((p_cursor->>'at')::timestamptz,(p_cursor->>'id')::uuid))
 order by r.created_at desc,r.id desc limit p_limit+1)q;
 if jsonb_array_length(items)>p_limit then items=items-(p_limit);nextc=jsonb_build_object('at',items->(p_limit-1)->>'created_at','id',items->(p_limit-1)->>'id');end if;
 return jsonb_build_object('rows',items,'next_cursor',nextc,'counts',(select jsonb_build_object('pending',count(*) filter(where r.status='pending'),'confirmed',count(*) filter(where r.status='confirmed'),'closed',count(*) filter(where r.status in ('declined','cancelled'))) from widget_private.requests r join public.widget_configs w on w.id=r.widget_id where w.property_id=p_property));
end $$;
create function public.booking_owner_detail(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r widget_private.requests;prop uuid;hs text;history jsonb;
begin
 select * into r from widget_private.requests where id=p_id;
 select property_id into prop from public.widget_configs where id=r.widget_id;perform widget_private.booking_assert_owner(prop);
 select case when status='active' and expires_at<=clock_timestamp() then 'expired' else status end into hs from widget_private.holds where request_id=p_id;
 select coalesce(jsonb_agg(jsonb_build_object('at',at,'action',action) order by id),'[]') into history from widget_private.history where request_id=p_id;
 return to_jsonb(r)-'actor_hash'-'fingerprint'-'idempotency'||jsonb_build_object('hold_status',coalesce(hs,'none'),'hold_expires_at',(select expires_at from widget_private.holds where request_id=p_id),'needs_action',r.status='pending' or r.status='confirmed','history',history);
end $$;
create function public.booking_owner_contacts(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare prop uuid;c widget_private.contacts;
begin
 select w.property_id into prop from widget_private.requests r join public.widget_configs w on w.id=r.widget_id where r.id=p_id;perform widget_private.booking_assert_owner(prop);
 if not public.widget_v2_rate_limit('reveal:'||auth.uid(),120,60) then raise exception 'rate_limited' using errcode='P0001';end if;
 select * into c from widget_private.contacts where request_id=p_id;insert into widget_private.history(request_id,actor,action) values(p_id,auth.uid(),'contacts_viewed');
 return jsonb_build_object('name',c.name,'phone',c.phone,'comment',c.comment);
end $$;
create function public.booking_owner_today(p_property uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform widget_private.booking_assert_owner(p_property);
 return jsonb_build_object('pending',(select count(*) from widget_private.requests r join public.widget_configs w on w.id=r.widget_id where w.property_id=p_property and r.status='pending'),
 'arrivals',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select r.checkin,u.unit_code as unit_name from public.reservations r join public.physical_units u on u.id=r.unit_id where u.property_id=p_property and r.status='confirmed' and r.checkin>=(clock_timestamp() at time zone 'Europe/Kaliningrad')::date order by r.checkin,r.id limit 5)x),
 'events',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select h.at,h.action from widget_private.history h join widget_private.requests r on r.id=h.request_id join public.widget_configs w on w.id=r.widget_id where w.property_id=p_property order by h.at desc,h.id desc limit 8)x));
end $$;
revoke all on function public.booking_owner_today(uuid) from public,anon,authenticated;
grant execute on function public.booking_owner_today(uuid) to authenticated;
create function public.booking_owner_capabilities() returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('lifecycle',widget_private.ledger_ready(),'ledger_complete',false)$$;

create function public.booking_owner_calendar(p_property uuid,p_month text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d date;events jsonb;
begin
 perform widget_private.booking_assert_owner(p_property);
 begin if p_month !~ '^\d{4}-\d{2}$' then raise exception 'invalid';end if;d=(p_month||'-01')::date;exception when others then raise exception 'invalid_payload' using errcode='22023';end;
 select coalesce(jsonb_agg(distinct jsonb_build_object('unit_id',u.id,'starts_on',(a.starts_at at time zone 'UTC')::date,'ends_on',(a.ends_at at time zone 'UTC')::date,'kind',case when a.widget_hold_id is not null then 'hold' when a.allocation_kind='block' then 'block' when a.external_ref is not null then 'external' else 'reservation' end,'source',case when a.external_ref is not null then 'Внешний канал (тест)' else 'Supabase ledger' end,'id',a.id,'block_id',a.block_id,'request_id',h.request_id)),'[]') into events
 from public.inventory_allocations a join public.unit_resource_requirements m on m.resource_id=a.resource_id join public.physical_units u on u.id=m.unit_id left join widget_private.holds h on h.id=a.widget_hold_id
 where u.property_id=p_property and a.starts_at<(d+interval '1 month') at time zone 'UTC' and a.ends_at>d::timestamp at time zone 'UTC' and (h.id is null or (h.status='active' and h.expires_at>clock_timestamp()));
 -- Complete only inside this isolated ledger, never a live-channel readiness claim.
 return jsonb_build_object('events',events,'complete',false,'units',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',unit_code)),'[]') from public.physical_units where property_id=p_property and active));
end $$;

create function public.booking_owner_release_block(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare prop uuid;
begin
 select u.property_id into prop from public.unit_blocks b join public.physical_units u on u.id=b.unit_id where b.id=p_id;perform widget_private.booking_assert_owner(prop);
 if not public.widget_v2_rate_limit('block-release:'||auth.uid(),120,60) then raise exception 'rate_limited' using errcode='P0001';end if;
 perform pg_catalog.pg_advisory_xact_lock(739251,1);
 update public.unit_blocks set released_at=clock_timestamp() where id=p_id and released_at is null;
 if found then insert into widget_private.history(block_id,actor,action) values(p_id,auth.uid(),'block_released');end if;
end $$;


revoke all on function public.booking_public_availability(text,date,date) from public,anon,authenticated;
grant execute on function public.booking_public_availability(text,date,date) to service_role;

-- Soft archive keeps historical requests and FKs. Public projection ignores archives.
create or replace function public.widget_v2_remove(p_id uuid,p_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare w public.widget_configs;
begin select * into w from public.widget_configs where id=p_id for update;perform widget_private.booking_assert_owner(w.property_id);
 if w.revision is distinct from p_revision then raise exception 'revision_conflict' using errcode='40001';end if;
 update public.widget_configs set archived_at=clock_timestamp(),published=null,revision=revision+1 where id=p_id;
end $$;
create or replace function public.widget_v2_config(p_widget text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('publicId',w.public_id,'version',w.published_version,'config',w.published) from public.widget_configs w join public.properties p on p.id=w.property_id join public.physical_units u on u.id=w.unit_id and u.property_id=p.id where w.public_id=p_widget and w.archived_at is null and w.published is not null and p.published and u.active
$$;
create function public.booking_cleanup_limits() returns bigint language plpgsql security definer set search_path='' as $$
declare n bigint;begin delete from widget_private.rate_buckets where expires_at<clock_timestamp()-interval '1 day';get diagnostics n=row_count;return n;end $$;

-- Old isolated submit/availability must not be an alternative unprotected write/read path.
revoke execute on function public.widget_v2_submit(text,jsonb,uuid,text) from service_role;
revoke execute on function public.widget_v2_availability(text,date,date) from anon,authenticated;
revoke execute on function public.widget_v2_owner_requests(uuid) from authenticated;
revoke all on all functions in schema widget_private from public,anon,authenticated;
revoke all on function public.booking_submit(text,jsonb,uuid,text,text),public.booking_expire_holds(),public.booking_cleanup_limits(),public.booking_owner_transition(uuid,text,integer,uuid),public.booking_owner_list(uuid,text,jsonb,integer,text),public.booking_owner_detail(uuid),public.booking_owner_contacts(uuid),public.booking_owner_capabilities(),public.booking_owner_calendar(uuid,text),public.booking_owner_release_block(uuid) from public,anon,authenticated;
grant execute on function public.booking_submit(text,jsonb,uuid,text,text),public.booking_expire_holds(),public.booking_cleanup_limits() to service_role;
grant execute on function public.booking_owner_transition(uuid,text,integer,uuid),public.booking_owner_list(uuid,text,jsonb,integer,text),public.booking_owner_detail(uuid),public.booking_owner_contacts(uuid),public.booking_owner_capabilities(),public.booking_owner_calendar(uuid,text),public.booking_owner_release_block(uuid) to authenticated;
alter function public.booking_owner_transition(uuid,text,integer,uuid) set lock_timeout='2s';
alter function public.booking_owner_release_block(uuid) set lock_timeout='2s';
alter function widget_private.lock_unit_resources(uuid) set lock_timeout='2s';
commit;
