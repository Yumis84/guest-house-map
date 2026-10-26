-- Transactional events contain identifiers/status only, never guest contacts.
begin;
create table widget_private.outbox(id bigint primary key references widget_private.history(id),action text not null,request_id uuid,legacy_request_id uuid,block_id uuid,state text not null default 'pending' check(state in('pending','leased','sent','failed')),attempts integer not null default 0,available_at timestamptz not null default clock_timestamp(),lease uuid,lease_until timestamptz,last_code text);
alter table widget_private.outbox enable row level security;
revoke all on widget_private.outbox from public,anon,authenticated;
create index booking_outbox_due on widget_private.outbox(available_at,id) where state in('pending','leased');
create function widget_private.enqueue_booking_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.action in('request_created_with_hold','request_created_without_hold_conflict','confirm','decline','cancel','hold_expired','block_created','block_released') then
 insert into widget_private.outbox(id,action,request_id,legacy_request_id,block_id) values(new.id,new.action,new.request_id,new.legacy_request_id,new.block_id) on conflict(id) do nothing;end if;return new;
end $$;
revoke all on function widget_private.enqueue_booking_event() from public,anon,authenticated;
create trigger booking_outbox_event after insert on widget_private.history for each row execute function widget_private.enqueue_booking_event();
create function public.booking_outbox_claim(p_limit integer default 20) returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare result jsonb;begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_payload' using errcode='22023';end if;
 update widget_private.outbox set state='failed',lease=null,lease_until=null where attempts>=8 and state in('pending','leased') and (lease_until is null or lease_until<=clock_timestamp());
 with due as(select id from widget_private.outbox where attempts<8 and available_at<=clock_timestamp() and (state='pending' or(state='leased' and lease_until<=clock_timestamp())) order by available_at,id for update skip locked limit p_limit),changed as(update widget_private.outbox x set state='leased',attempts=attempts+1,lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '30 seconds' from due where x.id=due.id returning x.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'action',action,'request_id',request_id,'legacy_request_id',legacy_request_id,'block_id',block_id,'lease',lease,'attempts',attempts)),'[]') into result from changed;return result;
end $$;
create function public.booking_outbox_ack(p_id bigint,p_lease uuid,p_success boolean,p_code text default '') returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_success is null or length(coalesce(p_code,''))>40 or coalesce(p_code,'') !~ '^[A-Za-z0-9_-]*$' then raise exception 'invalid_payload' using errcode='22023';end if;
 update widget_private.outbox set state=case when p_success then 'sent' when attempts>=8 then 'failed' else 'pending' end,available_at=clock_timestamp()+make_interval(secs=>least(300,power(2,attempts)::integer)),lease=null,lease_until=null,last_code=p_code where id=p_id and state='leased' and lease=p_lease and lease_until>clock_timestamp();return found;
end $$;
revoke all on function public.booking_outbox_claim(integer),public.booking_outbox_ack(bigint,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.booking_outbox_claim(integer),public.booking_outbox_ack(bigint,uuid,boolean,text) to service_role;
commit;
