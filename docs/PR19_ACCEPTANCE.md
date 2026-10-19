# PR 19: catalog acceptance

Status: draft. Do not merge or deploy without owner approval.

Confirmed by independent Claude review 72962322 (HEAD 68c0468): keyboard Enter bug fixed, no JS errors in offline Chromium at widths 320, 390 and 430. Locality search, keyboard focus, reset, duplicate locality names (synthetic), property type filtering and nested-unit deduplication passed.

Still outstanding:
- K8: network-enabled map preview. Verify locality selection changes map markers, unmatched search removes all markers without errors, reset restores 7 markers.
- K3/K10: live Supabase publication and RLS not tested. Static catalog currently reads window.GUEST_HOUSES, excluding inactive and nested entries. Do not claim Supabase integration.
- Supabase project reference for this repository is unconfirmed. Do not use unrelated guest-house-booking or Student Agency databases.

Public catalog contract (future): expose only published, nondeleted, top-level properties and approved locality IDs. Keep static data until migration is verified. SQL draft in sql/sandbox is intentionally non-executable. Require schema precheck, anon isolation tests, rollback and explicit cutover decision.

Current UI source: feature/catalog-location-type-filters. Main and production remain unchanged.
