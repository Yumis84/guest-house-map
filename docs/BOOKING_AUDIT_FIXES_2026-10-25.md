# Independent audit 83f15f0b: isolated fixes

Claude reproduced PR30's 19 native PostgreSQL groups and 12 adversarial scenarios. No integrity defect in the ledger; production NO-GO. Two P1 findings are fixed here:

- `booking_submit` computes SHA-256 inside PostgreSQL over normalized dates, guests, name, phone, comment and consent. Caller fingerprint is a validated hint; changing dates with the same key and hint raises `idempotency_conflict`.
- Owner transition resolves ownership before global/resource locks or expiry work. Owner transition and block-release calls have per-user rate limits. All booking mutation entry points have a two-second lock timeout; retry keeps the same key.

Added adversarial regression: hold the global lock from another connection; a stranger must immediately receive `not_found` under a 500ms statement timeout, while the authorized owner gets `55P03` within the bounded wait. Native PostgreSQL 17.11: 21 groups PASS (including the previously local HTTP-handler -> SQL -> owner confirm group).

Fixed the previously local Edge entrypoint syntax; extracted fail-closed Turnstile verification. Six provider-contract tests reject wrong hostname/action/widget, duplicate token, HTTP/JSON/network failure. These are mocked provider tests, not real CAPTCHA acceptance. Server keys stay server-side.

No production schema, authorization, workflow or main changed. Candidates must be reviewed as a stack before any separately authorized application. The global gate remains a deliberate single-house-pilot limitation. Hosted GoTrue, actual Edge gateway/IP provenance, real Turnstile and a coordinated production cutover are still release gates. Hold-less request quotas remain a policy proposal; current Edge IP/widget/phone limits are enforced before admission. Scheduler code already exists at scripts/booking-maintenance.mjs, but is not deployed.
