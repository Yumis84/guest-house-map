// Synthetic/local runner. Production scheduling requires separate approval.
import { createRequire } from "node:module";
const require = createRequire(process.env.PG_MODULE_ROOT || import.meta.url),
  { Client } = require("pg");
const url = process.env.BOOKING_TEST_DATABASE_URL;
if (
  !url ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
  !new URL(url).pathname.startsWith("/synthetic_booking_")
)
  throw Error("Synthetic loopback DB required");
const c = new Client({ connectionString: url });
await c.connect();
try {
  await c.query("set role service_role");
  do {
    await c.query("select booking_expire_holds(),booking_cleanup_limits()");
    if (process.argv.includes("--watch"))
      await new Promise((r) => setTimeout(r, 1000));
  } while (process.argv.includes("--watch"));
} finally {
  await c.end();
}
