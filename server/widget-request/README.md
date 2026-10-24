# Request handler — deployment candidate

Not deployed. `index.ts` is the Deno entry point; `handler.mjs` is dependency-injected and tested by `node widget-v2.edge.test.mjs`. No production requests are made by tests.

Deployment requires a separately reviewed Supabase Edge Function route, public invocation without a user JWT, and exact `WIDGET_ORIGIN`. This does not change owner authentication. Browser requests use `credentials: omit`; CORS is not an anti-bot or embed-domain access control.

Required server-only values: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, random `WIDGET_HASH_SECRET` (32+ characters), `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAME`, `WIDGET_ORIGIN`, `WIDGET_TRUSTED_IP_HEADER`, `WIDGET_GATEWAY_REVIEWED=true`, `WIDGET_BOOKING_ENABLED=true`. Defaults fail closed. Never put secret/service-role keys in runtime-config.js or owner HTML. Public site key is safe for the client but must match the approved Turnstile deployment.

Before setting gateway reviewed: prove by a staging request that the gateway overwrites the selected IP header and cannot be spoofed by the caller. An untrusted forwarded header is not a usable rate-limit identity. The handler also applies a widget-global limit independent of IP and a phone limit. HMAC keys store neither raw IP nor telephone in the limiter. Do not log request bodies. Rate limits count attempts (including failed CAPTCHA and retries), not only accepted requests. The submit RPC is service-role-only; a direct client cannot bypass the limiter/CAPTCHA via it.

Turnstile adapter verifies `success`, expected hostname, `action=booking`, and `cdata=public_widget_id`; provider errors and missing configuration deny submission. The CAPTCHA product remains an owner decision; replace the provider adapter and runtime client together if another provider is selected. See https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ .

The SQL unit lock prevents competing V2 holds, and idempotency returns the same request for a retry with the same payload. It does NOT prove synchronization with legacy writers: activation requires verified shared inventory/locking, a reviewed confirmation/decline lifecycle and owner inbox integration. Public availability never treats adapter failure as empty/free inventory.

Operational gates: configure request/contact retention and deletion; expire/remove old rate_buckets periodically via reviewed maintenance; stress-test limits and simultaneous requests using multiple real DB sessions in staging; measure trusted IP behavior; verify CAPTCHA accessibility and regional reachability. None of these are enabled by committing this file. No rollback or revoke of the live Stepan RPC is executed here.
