-- ONLY a fresh, disposable LOCAL Supabase stack. Existing tables cause failure.
-- Auth and Storage schemas/roles are provided by the local stack.
begin;
create table public.companies(id uuid primary key default gen_random_uuid(),name text not null);
create table public.company_members(company_id uuid references companies(id),user_id uuid references auth.users(id),member_role text not null check(member_role in ('owner','admin','manager','viewer')),primary key(company_id,user_id));
create table public.properties(id uuid primary key default gen_random_uuid(),company_id uuid not null references companies(id),source_key text unique,name text not null,locality text not null,description text,published boolean not null default false);
alter table public.companies enable row level security;
alter table public.properties enable row level security;
alter table public.company_members enable row level security;
grant all on public.properties to anon,authenticated;
create policy published_properties_read on public.properties for select to anon,authenticated using(published);
create policy members_can_read_own_membership on public.company_members for select to authenticated using(user_id=(select auth.uid()));
commit;
