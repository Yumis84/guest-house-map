-- Isolated test baseline only. Never run against a hosted project.
create role anon;
create role authenticated;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as $$
select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth,storage to anon,authenticated;
create table auth.users(id uuid primary key);
create table public.companies(id uuid primary key,name text not null);
create table public.company_members(company_id uuid references companies(id),user_id uuid references auth.users(id),member_role text check(member_role in ('owner','admin','manager','viewer')),primary key(company_id,user_id));
create table public.properties(id uuid primary key,company_id uuid not null references companies(id),source_key text unique,name text not null,locality text not null,description text,published boolean not null default false);
alter table public.properties enable row level security;
alter table public.company_members enable row level security;
grant all on public.properties to anon,authenticated;
create policy published_properties_read on public.properties for select to anon,authenticated using(published);
create policy members_can_read_own_membership on public.company_members for select to authenticated using(user_id=(select auth.uid()));
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to anon,authenticated;
insert into companies values('10000000-0000-0000-0000-000000000001','A'),('10000000-0000-0000-0000-000000000002','B');
insert into auth.users select ('20000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,6)n;
insert into company_members values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','owner'),
('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','owner'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','viewer'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','manager'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006','admin');
insert into properties(id,company_id,name,locality,published) values
('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A draft','A',false),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','B draft','B',false),
('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','B public','B',true);
