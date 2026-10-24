-- CANDIDATE ONLY. Apply nowhere automatically. Depends on config candidate.
-- Deliberately disabled until inventory adapter + business rules have been reviewed.
begin;
create table widget_private.activation (
 unit_id uuid primary key references public.physical_units(id),
 inventory_verified boolean not null default false,
 capacity integer not null check(capacity between 1 and 100),
 hold_minutes integer check(hold_minutes between 0 and 1440),
 enabled boolean not null default false
);
create table widget_private.requests (
 id uuid primary key default gen_random_uuid(),widget_id uuid not null references public.widget_configs(id) on delete restrict,
 unit_id uuid not null references public.physical_units(id),checkin date not null,checkout date not null,
 guests integer not null,status text not null default 'pending' check(status in ('pending','confirmed','declined','cancelled')),
 expires_at timestamptz not null,created_at timestamptz not null default now(),
 idempotency uuid not null,fingerprint text not null,unique(widget_id,idempotency),check(checkout>checkin)
);
create index widget_requests_inventory on widget_private.requests(unit_id,checkin,checkout);
create table widget_private.contacts (
 request_id uuid primary key references widget_private.requests(id) on delete cascade,
 name text not null,phone text not null,comment text not null,consent_at timestamptz not null default now(),
 policy_url text not null,config_version integer not null
);
create table widget_private.rate_buckets(key text primary key,count integer not null,expires_at timestamptz not null);
alter table widget_private.activation enable row level security;
alter table widget_private.requests enable row level security;
alter table widget_private.contacts enable row level security;
alter table widget_private.rate_buckets enable row level security;
revoke all on all tables in schema widget_private from public,anon,authenticated;

-- REQUIRED integration seam. Replace only in a reviewed staging migration after
-- inspecting ALL existing confirmed reservations, legacy pending holds and blocks.
-- No empty/success fallback: an unavailable inventory source must never look free.
create function widget_private.inventory_blocks(p_unit uuid,p_start date,p_end date)
returns table(starts_on date,ends_on date) language plpgsql set search_path='' as $$
begin raise exception 'inventory_adapter_not_verified' using errcode='55000';end $$;

create function public.widget_v2_availability(p_widget text,p_start date,p_end date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.widget_configs; a widget_private.activation; blocks jsonb;
begin
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>366 then raise exception 'invalid_range';end if;
 select * into w from public.widget_configs where public_id=p_widget;
 if not found or public.widget_v2_config(p_widget) is null then return null;end if;
 select * into a from widget_private.activation where unit_id=w.unit_id;
 if not found or not a.enabled or not a.inventory_verified or a.hold_minutes is null or coalesce(w.published->>'policyUrl','')='' then
 return jsonb_build_object('ready',false,'blocks','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('starts_on',b.starts_on,'ends_on',b.ends_on)),'[]'::jsonb) into blocks
 from (
 select * from widget_private.inventory_blocks(w.unit_id,p_start,p_end)
 union all select r.checkin,r.checkout from widget_private.requests r where r.unit_id=w.unit_id
 and (r.status='confirmed' or (r.status='pending' and r.expires_at>now()))
 and r.checkin<p_end and r.checkout>p_start
 ) b;
 return jsonb_build_object('ready',true,'capacity',a.capacity,'blocks',blocks);
end $$;

-- Persistent atomic limiter, not per-instance process memory. Called before CAPTCHA.
create function public.widget_v2_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if length(p_key)>200 or p_limit<1 or p_limit>1000 or p_seconds<1 or p_seconds>86400 then raise exception 'invalid_limit';end if;
 insert into widget_private.rate_buckets as b values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set count=case when b.expires_at<=now() then 1 else least(b.count+1,1001) end,
 expires_at=case when b.expires_at<=now() then now()+make_interval(secs=>p_seconds) else b.expires_at end
 returning count into n;
 return n<=p_limit;
end $$;

create function public.widget_v2_submit(p_widget text,p_payload jsonb,p_idempotency uuid,p_fingerprint text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.widget_configs;a widget_private.activation;r widget_private.requests;d1 date;d2 date;g integer;
begin
 select * into w from public.widget_configs where public_id=p_widget for share;
 if not found or public.widget_v2_config(p_widget) is null then raise exception 'widget_unavailable' using errcode='55000';end if;
 select * into a from widget_private.activation where unit_id=w.unit_id;
 if not found or not a.enabled or not a.inventory_verified or a.hold_minutes is null or coalesce(w.published->>'policyUrl','')='' then
 raise exception 'widget_not_activated' using errcode='55000';end if;
 -- This lock serializes V2 writers. Deployment gate: legacy writers must participate
 -- in the SAME lock or an exclusion constraint before activating any shared unit.
 perform 1 from public.physical_units where id=w.unit_id and active and property_id=w.property_id for update;
 if not found then raise exception 'widget_unavailable' using errcode='55000';end if;
 select * into r from widget_private.requests where widget_id=w.id and idempotency=p_idempotency;
 if found then
 if r.fingerprint<>p_fingerprint then raise exception 'idempotency_conflict' using errcode='23505';end if;
 return jsonb_build_object('accepted',true,'requestId',r.id);end if;
 if p_payload->>'checkin' !~ '^\d{4}-\d{2}-\d{2}$' or p_payload->>'checkout' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_dates';end if;
 d1=(p_payload->>'checkin')::date;d2=(p_payload->>'checkout')::date;g=(p_payload->>'guests')::integer;
 if d1 is null or d2 is null or g is null or d1<(now() at time zone 'Europe/Kaliningrad')::date or d2<=d1 or d2-d1>90
 or d1>(now() at time zone 'Europe/Kaliningrad')::date+730 or g<1 or g>a.capacity
 or p_payload->'consent' is distinct from 'true'::jsonb or length(trim(coalesce(p_payload->>'name',''))) not between 1 and 120
 or coalesce(p_payload->>'phone','') !~ '^\+[1-9][0-9]{6,14}$' or length(coalesce(p_payload->>'comment',''))>1000
 or p_idempotency is null or coalesce(p_fingerprint,'') !~ '^[a-f0-9]{64}$'
 then raise exception 'invalid_payload';end if;
 if exists(select 1 from widget_private.inventory_blocks(w.unit_id,d1,d2) b where b.starts_on<d2 and b.ends_on>d1)
 or exists(select 1 from widget_private.requests where unit_id=w.unit_id and checkin<d2 and checkout>d1
 and (status='confirmed' or (status='pending' and expires_at>now())))
 then raise exception 'dates_unavailable' using errcode='23P01';end if;
 insert into widget_private.requests(widget_id,unit_id,checkin,checkout,guests,expires_at,idempotency,fingerprint)
 values(w.id,w.unit_id,d1,d2,g,now()+make_interval(mins=>a.hold_minutes),p_idempotency,p_fingerprint) returning * into r;
 insert into widget_private.contacts(request_id,name,phone,comment,policy_url,config_version)
 values(r.id,trim(p_payload->>'name'),p_payload->>'phone',coalesce(p_payload->>'comment',''),w.published->>'policyUrl',w.published_version);
 return jsonb_build_object('accepted',true,'requestId',r.id);
end $$;

-- Owner inbox bridge for the isolated V2 request store; never expose it to anon.
create function public.widget_v2_owner_requests(p_property uuid) returns table(id uuid,checkin date,checkout date,guests integer,status text,guest_name text,phone text,comment text)
language plpgsql security definer set search_path='' as $$
begin
 perform widget_private.assert_owner(p_property);
 return query select r.id,r.checkin,r.checkout,r.guests,r.status,c.name,c.phone,c.comment
 from widget_private.requests r join public.widget_configs w on w.id=r.widget_id
 join widget_private.contacts c on c.request_id=r.id where w.property_id=p_property order by r.created_at desc limit 100;
end $$;
revoke all on all functions in schema widget_private from public,anon,authenticated;
revoke all on function public.widget_v2_rate_limit(text,integer,integer),public.widget_v2_submit(text,jsonb,uuid,text),
 public.widget_v2_availability(text,date,date),public.widget_v2_owner_requests(uuid) from public,anon,authenticated;
grant execute on function public.widget_v2_rate_limit(text,integer,integer),public.widget_v2_submit(text,jsonb,uuid,text) to service_role;
grant execute on function public.widget_v2_availability(text,date,date) to anon,authenticated;
grant execute on function public.widget_v2_owner_requests(uuid) to authenticated;
commit;
