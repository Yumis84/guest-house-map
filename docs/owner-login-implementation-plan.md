# Owner Cabinet V1: rollout and security gates

## Implemented on feature/owner-login-shell-v1
- `login.html`: email/password sign-in and sign-up shell, disabled until configured.
- `owner.html`: guarded dashboard shell, read-only list of company properties; redirect unauthenticated users to login.
- `supabase-public-config.js`: shared public URL and publishable/anon key placeholders. Never use service-role/secret keys.
- Catalog link and locality filter (PR #7).

## Not yet completed
1. Confirm actual Supabase schema for `company_members` and `properties` (column names, types, RLS). Current UI assumes `company_members(user_id,company_id,role)` and `properties(id,name,published,company_id)`; adjust based on verified schema before activation.
2. Configure Supabase Auth email/password, email confirmation, recovery URLs, allowed origins, and public configuration.
3. Verify that membership cannot be self-granted and RLS restricts company properties to authorized members. Test owner A versus owner B using actual authenticated sessions. Client-side company filtering alone is NOT a security boundary.
4. Create initial verified company membership using privileged admin workflow, not browser writes.
5. Add secure property edit forms and image uploads with RLS/storage policies.
6. Browser smoke tests: mobile, login, logout, session expiration, no-membership, unauthorized property ID, locality filters.
7. Keep PR draft until security acceptance and deployment approval. Do not enable booking or inventory mutation.

Tracking: GitHub Issue #8, Draft PR #7. Hub Project Space guest-house-map is separate from Eduard's guest-house-booking space.
