-- DESIGN CANDIDATE ONLY. Do not apply to hosted or production Supabase.
-- Requires review against the actual Owner Cabinet baseline before any isolated-stack test.

create table public.publication_reviewer_roles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role in ('reviewer', 'publisher', 'admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid not null references auth.users(id) on delete restrict
);

create table public.publication_submissions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  source_key text not null,
  base_revision bigint not null check (base_revision >= 0),
  patch jsonb not null check (jsonb_typeof(patch) = 'object' and patch <> '{}'::jsonb),
  patch_sha256 text not null check (patch_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked', 'candidate', 'published')),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  decision_reason text,
  candidate_snapshot_id text,
  published_at timestamptz,
  constraint publication_submission_decision_complete check (
    (status = 'pending' and decided_by is null and decided_at is null and decision_reason is null) or
    (status <> 'pending' and decision_reason is not null)
  ),
  constraint publication_submission_independent_review check (decided_by is null or decided_by <> submitted_by),
  unique (id, property_id, company_id, source_key)
);

create unique index publication_one_open_submission_per_property
  on public.publication_submissions(property_id)
  where status in ('pending', 'approved', 'candidate');

create table public.publication_audit_events (
  sequence bigint generated always as identity primary key,
  event_id uuid not null unique default gen_random_uuid(),
  event_type text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  submission_id uuid references public.publication_submissions(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  previous_event_hash text check (previous_event_hash is null or previous_event_hash ~ '^[a-f0-9]{64}$'),
  event_hash text not null unique check (event_hash ~ '^[a-f0-9]{64}$')
);

create table public.publication_snapshots (
  snapshot_id text primary key,
  submission_id uuid not null unique references public.publication_submissions(id) on delete restrict,
  previous_snapshot_id text references public.publication_snapshots(snapshot_id) on delete restrict,
  snapshot_sha256 text not null unique check (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  manifest_sha256 text not null unique check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  selected_at timestamptz,
  revoked_at timestamptz
);

create table public.publication_pointer (
  singleton boolean primary key default true check (singleton),
  pointer_version bigint not null check (pointer_version >= 0),
  snapshot_id text references public.publication_snapshots(snapshot_id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict
);

alter table public.publication_reviewer_roles enable row level security;
alter table public.publication_submissions enable row level security;
alter table public.publication_audit_events enable row level security;
alter table public.publication_snapshots enable row level security;
alter table public.publication_pointer enable row level security;

revoke all on public.publication_reviewer_roles, public.publication_submissions,
  public.publication_audit_events, public.publication_snapshots, public.publication_pointer
  from public, anon, authenticated;

grant select on public.publication_submissions to authenticated;
grant select on public.publication_audit_events, public.publication_snapshots, public.publication_pointer to authenticated;

create policy publication_owner_read_own_submissions on public.publication_submissions
  for select to authenticated using (
    exists (select 1 from public.company_members cm
      where cm.company_id = publication_submissions.company_id
        and cm.user_id = (select auth.uid()))
    or exists (select 1 from public.publication_reviewer_roles rr
      where rr.user_id = (select auth.uid()))
  );

create policy publication_reviewer_read_audit on public.publication_audit_events
  for select to authenticated using (
    exists (select 1 from public.publication_reviewer_roles rr where rr.user_id = (select auth.uid()))
  );

create policy publication_reviewer_read_snapshots on public.publication_snapshots
  for select to authenticated using (
    exists (select 1 from public.publication_reviewer_roles rr where rr.user_id = (select auth.uid()))
  );

create policy publication_reviewer_read_pointer on public.publication_pointer
  for select to authenticated using (
    exists (select 1 from public.publication_reviewer_roles rr where rr.user_id = (select auth.uid()))
  );

-- No INSERT/UPDATE/DELETE grants are intentionally exposed. Submission, review, revoke, candidate creation,
-- pointer compare-and-swap, publication and rollback must be SECURITY DEFINER functions
-- with a fixed search_path, current membership/role lookup, row locks, transition checks,
-- immutable artifact hash verification and append-only audit insertion in one transaction.
-- Those functions remain blocked until this candidate is exercised on disposable Supabase.
