# Booking candidate M0–M3 · 25.10.2026

Authority: owner WORK instruction 25 October; supersedes Claude B2's expired-request proposal. Audits read: A 80a0be1c, B1 455bb06d, B2 bd5157c2. Grok visual research read at 5b058f7, Concept A forest operator; use current HTML/CSS/JS.

Request and hold are independent: request pending survives expiry; hold active/expired/released/converted. Reservation confirmed/cancelled. Confirmation after expiry repeats server availability check. Never reactivate an expired hold.

M0: separate owner candidate page, forest tokens, Today/Requests/Calendar/Reservations/Widget, detail dialog, masked list, month grid and source legend. Read-only until verified backend capability. Synthetic fixture mode clearly labelled, no live integrations.

M1: extend existing candidate private requests with separate hold records, server authorization, idempotent transitions, history/contact access audit, cursor paging. Stable domain errors, archived widgets, ru-only parity, bounded holds, limiter cleanup. No production migrations.

M2: re-use existing inventory_allocations/resource mapping/exclusion; hold allocations join same exclusion domain as reservations and manual blocks. Shared resource locks, lazy expiry at every writer + scheduled expiry worker; requests survive. Isolated real PostgreSQL tests with multiple sessions, shared-parent resources and a synthetic external writer. Working n8n remains untouched. Document staged Sheets cutover/reconciliation.

M3: wire verified backend to owner candidate and public month grid; browser E2E with 150+ synthetic requests, 320/390/768/1440, keyboard/error paths. Independent audit request with reproducible package and test limits.

Privacy policy and retention are a proposal requiring separate approval. No main, production, authorization, live n8n, actual guests, merge or production migrations. New UI must not imply complete live availability before all channels participate. Every stage has its own Draft PR and Hub handoff.
