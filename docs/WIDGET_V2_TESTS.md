# V2 validation · 25 October 2026

Run:

```sh
npm ci --ignore-scripts
node widget-v2.core.test.mjs
node widget-v2.sql.test.mjs
node widget-v2.edge.test.mjs
node owner-widget.test.mjs
node widget-v2.browser.test.mjs
```

Set PLAYWRIGHT_MODULE to an installed Playwright index.mjs if it is supplied externally. Browser tests intercept Supabase and use synthetic data; no live booking submit is permitted. Browser happy-path Turnstile/Edge integration and multi-connection PostgreSQL races remain staging gates. Tests authored and run in this implementation are not a new independent human/agent audit; Claude's existing audit was read in full. No CI/workflow configuration was changed.

Recorded results are updated after execution below.

PASS: core validation/contrast/checkout-exclusive intervals/stable ID; existing SQL PGlite ACL/RLS/draft/publication/revision/overlap/idempotency tests; existing Edge mocked validation/CAPTCHA/rates/errors; existing owner embed regression; syntax and git diff --check.

PASS browser (real Chromium 143 via temporary @sparticuz/chromium 143.0.4, Playwright supplied by runtime): 320/390/1440 px, two object IDs, text-only malicious title, unready inventory disables form, two independent loaders, forged resize source rejected, button/modal open and close, authenticated synthetic owner create/save, unpublished code disabled, synthetic Turnstile callback and intercepted successful Edge submit. No production requests submitted. Download of Playwright's default Chromium failed; the packaged Chromium fallback ran successfully. Browser test accepts BROWSER_EXECUTABLE for this environment.

NOT RUN / NOT PROVEN: real Turnstile siteverify, deployed gateway/IP trust, deployed Edge, real owner database writes, multi-connection races and complete reservation lifecycle, new independent Claude audit, CI, published settings browser end-to-end against a live staging DB. SQL publication snapshots/stable public ID were verified in the disposable PGlite database. No staging deployment is authorized yet.
