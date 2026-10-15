# Owner Cabinet V1: RLS acceptance and migration candidate

**Status:** proposed, not applied to Supabase. Review before any production migration.

## Observed schema (2026-10-15)
- `public.properties(id, name, description, published, company_id, ...)`, RLS enabled.
- `public.company_members(company_id, user_id, member_role)`, RLS enabled.
- `company_members` SELECT policy restricts `user_id = auth.uid()`.
- `properties` SELECT policy currently grants `published = true` to anon and authenticated.
- There is no confirmed authenticated SELECT policy for an owner's unpublished properties.
- There is no confirmed owner UPDATE policy for `properties`.

## Proposed read-only migration (do not apply automatically)

```sql
-- Apply only after DBA review and a test with authenticated user sessions.
create policy "company_members_read_own_properties"
on public.properties
for select
to authenticated
using (
  exists (
    select 1
    from public.company_members as cm
    where cm.company_id = properties.company_id
      and cm.user_id = (select auth.uid())
  )
);
```

This is an additional permissive SELECT policy; it does not replace the public `published` policy. The company_members policy is user-scoped, avoiding a self-reference to the same table.

## Mandatory tests before enabling edit actions

1. Authenticated member A can read published and unpublished properties of company A.
2. Member A cannot read unpublished properties of company B.
3. Anonymous visitor can read published properties, but not unpublished ones.
4. User with no membership cannot read unpublished properties.
5. No client can INSERT/UPDATE/DELETE `company_members` or `properties` without explicitly authorized policies.
6. Verify role distinctions: viewer cannot edit; owner/manager edit rights only if approved.
7. Confirm that direct REST queries with forged `company_id` do not bypass RLS.
8. Verify grants, storage policies, and company member bootstrap separately.

**Note:** Supabase SQL editor executes with elevated DB rights and is not an adequate substitute for JWT-based end-to-end RLS tests. No production migration, membership assignment, or publishing is authorized by this document.
