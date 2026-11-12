# M0b completion · 25.10.2026

Base d60fc9f9. CI run40200857620 failed because label display:grid overrode the hidden attribute. Added explicit [hidden] display rule; initial view sync was already present and retained. Search blur was also issuing a duplicate list refresh between pointerdown and click on Details; identical search changes now do not re-render rows.

Behavior tests use a stateful synthetic transport outside product source. Verified initial filters/aria-current, request filter/search arguments, masked/revealed contacts, expired-hold pending request, focus after details refresh and calendar close; network→dates_unavailable→success reuses one key, confirm/cancel/reopen, revision_conflict→fresh key/revision, decline and needs_action=false. Errors appear inside open dialog. Compact day labels raised to11px.

Local PASS:6 unit tests and6 Playwright behavior scenarios, widths320/390/768/1440, no JS errors/overflow. No real bookings, server authorization or production lifecycle is claimed by this UI test. CI and independent Claude recheck are required on the final remote HEAD.
