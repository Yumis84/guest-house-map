import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(process.env.PG_MODULE_ROOT || import.meta.url),
  { Client } = require("pg");
const uri = process.env.BOOKING_TEST_DATABASE_URL;
if (
  !uri ||
  !["127.0.0.1", "localhost"].includes(new URL(uri).hostname) ||
  !new URL(uri).pathname.startsWith("/synthetic_booking_")
)
  throw Error("Explicit loopback synthetic_booking_* database required");
const connect = async () => {
  const c = new Client({ connectionString: uri });
  await c.connect();
  return c;
};
const db = await connect(),
  results = [];
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  p = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  u = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  u2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc",
  resource = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const cfg = {
  template: "calendar",
  theme: "light",
  accent: "#226b50",
  radius: 12,
  maxWidth: 720,
  fluid: true,
  title: "Synthetic forest house",
  language: "ru",
  buttonText: "Заявка",
  opening: "inline",
  policyUrl: "https://example.test/privacy",
};
const scalar = async (c, sql, args = []) =>
  Object.values((await c.query(sql, args)).rows[0])[0];
const test = async (name, fn) => {
  await fn();
  results.push({ name, result: "PASS" });
  console.log("PASS", name);
};
async function identity(c, user = owner) {
  await c.query("reset role");
  await c.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await c.query("set role authenticated");
}
const day = (n) =>
  new Date(Date.now() + 86400000 * n).toISOString().slice(0, 10);
let widget;
async function submit(
  c,
  n = 30,
  widgetId = widget.public_id,
  key = crypto.randomUUID(),
  actor = "a".repeat(64),
) {
  await c.query("reset role");
  await c.query("set role service_role");
  return scalar(c, "select booking_submit($1,$2,$3,$4,$5)", [
    widgetId,
    {
      checkin: day(n),
      checkout: day(n + 2),
      guests: 2,
      name: "Synthetic guest",
      phone: "+79000000000",
      comment: "synthetic only",
      consent: true,
    },
    key,
    "f".repeat(64),
    actor,
  ]);
}
async function transition(c, id, action, rev = 1, key = crypto.randomUUID()) {
  await identity(c);
  return scalar(c, "select booking_owner_transition($1,$2,$3,$4)", [
    id,
    action,
    rev,
    key,
  ]);
}
async function clear() {
  await db.query("reset role");
  await db.query(
    "truncate widget_private.operations,widget_private.history,widget_private.contacts,widget_private.holds,widget_private.requests,inventory_allocations,reservations,unit_blocks cascade",
  );
}
async function age(id) {
  await db.query("reset role");
  await db.query(
    "with t as materialized(select clock_timestamp() as now) update widget_private.holds set accepted_at=t.now-interval '16 minutes',expires_at=t.now-interval '1 minute' from t where request_id=$1",
    [id],
  );
}
try {
  await db.query(
    await readFile(new URL("./baseline.sql", import.meta.url), "utf8"),
  );
  const metadata = JSON.parse(
    await readFile(
      new URL(
        "../../docs/evidence/widget-v2-live-metadata.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  // Exact inventory trigger bodies from read-only live metadata; no actual rows.
  for (const name of [
    "ensure_unit_inventory_mapping",
    "sync_reservation_inventory",
    "sync_unit_block_inventory",
    "guard_inventory_mapping_changes",
  ])
    await db.query(metadata.rpcs.find((x) => x.name === name).definition);
  for (const trigger of metadata.triggers.filter(
    (x) => !x.includes("owner_property_revision"),
  ))
    await db.query(trigger);
  for (const f of [
    "widget-v2-config",
    "widget-v2-requests",
    "booking-m1-lifecycle", ...(process.env.BOOKING_M1_ONLY?[]:["booking-m2-ledger"]),
  ])
    await db.query(
      await readFile(
        new URL("../../sql/" + f + ".CANDIDATE.sql", import.meta.url),
        "utf8",
      ),
    );
  await db.query("insert into properties values($1,$1,true,$2)", [
    p,
    "Synthetic house",
  ]);
  await db.query("insert into company_members values($1,$2,$3)", [
    p,
    owner,
    "owner",
  ]);
  await db.query(
    "insert into physical_units values($1,$3,true,$4),($2,$3,true,$5)",
    [u, u2, p, "whole", "room"],
  );
  await db.query("insert into inventory_resources values($1,$2)", [
    resource,
    p,
  ]);
  await db.query(
    "insert into unit_resource_requirements values($1,$3,$4),($2,$3,$4)",
    [u, u2, resource, p],
  );
  await identity(db);
  widget = await scalar(
    db,
    "select to_jsonb(widget_v2_save(null,$1,$2,$3,$4,null))",
    [p, u, "Synthetic widget", cfg],
  );
  await db.query("select widget_v2_publish($1,1)", [widget.id]);
  await db.query("reset role");
  await db.query(
    "insert into widget_private.activation values($1,true,8,15,true)",
    [u],
  );
  await test("native PostgreSQL + btree_gist, baseline inventory trigger bodies loaded", async () => {
    assert.match(await scalar(db, "select version()"), /PostgreSQL/);
    assert.equal(
      await scalar(
        db,
        "select count(*)::int from pg_extension where extname='btree_gist'",
      ),
      1,
    );
  });
  if(process.env.BOOKING_M1_ONLY){
 await test('M1 capability fail closed until ledger installed',async()=>{await identity(db);assert.equal((await scalar(db,'select booking_owner_capabilities()')).lifecycle,false);await assert.rejects(transition(db,crypto.randomUUID(),'confirm'),e=>e.message==='not_ready');});
 await test('M1 owner paginated list and isolated contact reveal',async()=>{await db.query('reset role');const id=await scalar(db,"insert into widget_private.requests(widget_id,unit_id,checkin,checkout,guests,expires_at,idempotency,fingerprint) values($1,$2,current_date+30,current_date+31,1,now(),gen_random_uuid(),'synthetic') returning id",[widget.id,u]);await db.query("insert into widget_private.contacts(request_id,name,phone,comment,policy_url,config_version) values($1,'Synthetic','+79000001234','','https://example.test/privacy',1)",[id]);await identity(db);const page=await scalar(db,'select booking_owner_list($1)',[p]);assert.equal(page.rows.length,1);assert.ok(page.rows[0].short_code);assert.equal(page.counts.pending,1);assert.ok(!JSON.stringify(page).includes('+79000001234'));await scalar(db,'select booking_owner_contacts($1)',[id]);await identity(db,other);await assert.rejects(db.query('select booking_owner_detail($1)',[id]),e=>e.message==='not_found'&&e.code==='P0001');});
 }else{
  await test("simultaneous submits: requests retained, only one resource hold", async () => {
    const sessions = await Promise.all(Array.from({ length: 8 }, connect));
    try {
      await Promise.all(
        sessions.map((c, i) =>
          submit(
            c,
            30,
            widget.public_id,
            crypto.randomUUID(),
            i.toString(16).repeat(64),
          ),
        ),
      );
      await db.query("reset role");
      assert.equal(
        await scalar(db, "select count(*)::int from widget_private.requests"),
        8,
      );
      assert.equal(
        await scalar(
          db,
          "select count(*)::int from widget_private.holds where status='active'",
        ),
        1,
      );
    } finally {
      await Promise.all(sessions.map((c) => c.end()));
    }
  });
  await clear();
  await test("exact 15 minute hold + expiry preserves pending request + late confirmation", async () => {
    const r = await submit(db);
    await db.query("reset role");
    assert.equal(
      await scalar(
        db,
        "select extract(epoch from expires_at-accepted_at)::int from widget_private.holds",
      ),
      900,
    );
    await age(r.requestId);
    await db.query("select booking_expire_holds()");
    assert.equal(
      await scalar(db, "select status from widget_private.requests"),
      "pending",
    );
    assert.equal(
      await scalar(db, "select status from widget_private.holds"),
      "expired",
    );
    assert.equal(
      await scalar(db, "select count(*)::int from inventory_allocations"),
      0,
    );
    await transition(db, r.requestId, "confirm");
    await db.query("reset role");
    assert.equal(
      await scalar(db, "select status from reservations"),
      "confirmed",
    );
  });
  await clear();
  await test("expired request cannot confirm over manual block; remains pending", async () => {
    const r = await submit(db);
    await age(r.requestId);
    await db.query(
      "insert into unit_blocks(unit_id,starts_on,ends_on) values($1,$2,$3)",
      [u2, day(30), day(32)],
    );
    await assert.rejects(
      transition(db, r.requestId, "confirm"),
      (e) => e.code === "23P01",
    );
    await db.query("reset role");
    assert.equal(
      await scalar(db, "select status from widget_private.requests"),
      "pending",
    );
  });
  await clear();
  await test("simultaneous confirmations of overlapping pending requests: one succeeds", async () => {
    const a = await submit(db);
    const b = await submit(db);
    await age(a.requestId);
    const x = await connect(),
      y = await connect();
    try {
      const outcomes = await Promise.allSettled([
        transition(x, a.requestId, "confirm"),
        transition(y, b.requestId, "confirm"),
      ]);
      assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(
        outcomes.find((x) => x.status === "rejected").reason.code,
        "23P01",
      );
    } finally {
      await x.end();
      await y.end();
    }
  });
  await clear();
  await test("confirmation vs expiry worker, repeated confirmation and cancel keep record", async () => {
    const r = await submit(db);
    await age(r.requestId);
    const x = await connect(),
      y = await connect(),
      key = crypto.randomUUID();
    try {
      await Promise.all([
        transition(x, r.requestId, "confirm", 1, key),
        y.query("select booking_expire_holds()"),
      ]);
      assert.equal(
        (await transition(x, r.requestId, "confirm", 1, key)).status,
        "confirmed",
      );
      await transition(x, r.requestId, "cancel", 2);
      await db.query("reset role");
      assert.equal(
        await scalar(db, "select status from reservations"),
        "cancelled",
      );
      assert.equal(
        await scalar(db, "select count(*)::int from reservations"),
        1,
      );
      assert.equal(
        await scalar(db, "select count(*)::int from inventory_allocations"),
        0,
      );
    } finally {
      await x.end();
      await y.end();
    }
  });
  await clear();
  await test("hold vs real reservation trigger on sibling resource rejects overlap", async () => {
    await submit(db);
    await db.query("reset role");
    await assert.rejects(
      db.query(
        "insert into reservations(unit_id,checkin,checkout,status) values($1,$2,$3,'confirmed')",
        [u2, day(30), day(32)],
      ),
      (e) => e.code === "23P01",
    );
  });
  await clear();
  await test("synthetic external channel allocation vs hold uses same exclusion domain", async () => {
    const x = await connect(),
      y = await connect();
    try {
      const outcomes = await Promise.allSettled([
        submit(x),
        y.query(
          "insert into inventory_allocations(resource_id,unit_id,starts_at,ends_at,allocation_kind,external_ref) values($1,$2,$3,$4,'hold','synthetic_external')",
          [resource, u2, day(30), day(32)],
        ),
      ]);
      await db.query("reset role");
      assert.equal(
        await scalar(db, "select count(*)::int from inventory_allocations"),
        1,
      );
      assert.ok(outcomes.some((x) => x.status === "fulfilled"));
    } finally {
      await x.end();
      await y.end();
    }
  });
  await clear();
  await test("automatic maintenance process expires hold without changing request", async () => {
    const r = await submit(db);
    await age(r.requestId);
    const worker = spawn(
      process.execPath,
      ["scripts/booking-maintenance.mjs", "--watch"],
      { env: process.env, stdio: "pipe" },
    );
    try {
      let state;
      for (let i = 0; i < 100; i++) {
        state = await scalar(
          db,
          "select status from widget_private.holds where request_id=$1",
          [r.requestId],
        );
        if (state === "expired") break;
        await new Promise((r) => setTimeout(r, 30));
      }
      assert.equal(state, "expired");
      assert.equal(
        await scalar(
          db,
          "select status from widget_private.requests where id=$1",
          [r.requestId],
        ),
        "pending",
      );
    } finally {
      worker.kill();
      await new Promise((r) => worker.on("exit", r));
    }
  });
  await clear();
  await test("idempotent submit, normalized invalid payload errors, quota", async () => {
    const key = crypto.randomUUID(),
      a = await submit(db, 30, widget.public_id, key);
    assert.deepEqual(await submit(db, 30, widget.public_id, key), a);
    await assert.rejects(
      db.query("select booking_submit($1,$2,$3,$4,$5)", [
        widget.public_id,
        { guests: "abc" },
        crypto.randomUUID(),
        "f".repeat(64),
        "a".repeat(64),
      ]),
      (e) => e.code === "22023",
    );
    await submit(db, 40);
    await assert.rejects(submit(db, 50), (e) => e.code === "54000");
  });
  await clear();
  await test("150+ cursor paging + list masking + owner detail/contact authorization", async () => {
    await db.query("reset role");
    await db.query(
      "insert into widget_private.requests(widget_id,unit_id,checkin,checkout,guests,expires_at,idempotency,fingerprint) select $1,$2,current_date+90,current_date+91,1,now(),gen_random_uuid(),'synthetic' from generate_series(1,155)",
      [widget.id, u],
    );
    await identity(db);
    let cursor = null,
      ids = [];
    do {
      const page = await scalar(
        db,
        "select booking_owner_list($1,$2,$3,50,$4)",
        [p, "", cursor, ""],
      );
      ids.push(...page.rows.map((x) => x.id));
      assert.ok(!JSON.stringify(page).includes("phone"));
      cursor = page.next_cursor;
    } while (cursor);
    assert.equal(new Set(ids).size, 155);
    await identity(db, other);
    await assert.rejects(
      db.query("select booking_owner_detail($1)", [ids[0]]),
      (e) => e.code === "P0001" && e.message === "not_found",
    );
    await db.query("reset role");
    await db.query("set role anon");
    await assert.rejects(
      db.query("select * from widget_private.contacts"),
      (e) => e.code === "42501",
    );
  });
  await test("contacts are explicit and audited; anon availability denied; stable input errors", async () => {
    await db.query("reset role");
    const id = await scalar(
      db,
      "select id from widget_private.requests limit 1",
    );
    await identity(db);
    await db.query("select booking_owner_contacts($1)", [id]);
    await db.query("reset role");
    assert.equal(
      await scalar(
        db,
        "select count(*)::int from widget_private.history where action='contacts_viewed'",
      ),
      1,
    );
    await db.query("set role anon");
    await assert.rejects(
      db.query(
        "select booking_public_availability($1,current_date,current_date+30)",
        [widget.public_id],
      ),
      (e) => e.code === "42501",
    );
    await identity(db);
    await assert.rejects(
      db.query("select booking_owner_list($1,$2,$3,50,$4)", [
        p,
        "",
        { at: "bad", id: "bad" },
        "",
      ]),
      (e) => e.code === "22023",
    );
  });
  await test("manual block soft-release audited/idempotent and limiter cleanup", async () => {
    await db.query("reset role");
    const block = await scalar(
      db,
      "insert into unit_blocks(unit_id,starts_on,ends_on) values($1,$2,$3) returning id",
      [u, day(50), day(52)],
    );
    await identity(db);
    await db.query("select booking_owner_release_block($1)", [block]);
    await db.query("select booking_owner_release_block($1)", [block]);
    await db.query("reset role");
    assert.equal(await scalar(db, "select count(*)::int from unit_blocks"), 1);
    assert.equal(
      await scalar(db, "select count(*)::int from inventory_allocations"),
      0,
    );
    assert.equal(
      await scalar(
        db,
        "select count(*)::int from widget_private.history where action='block_released'",
      ),
      1,
    );
    await db.query(
      "insert into widget_private.rate_buckets values('old',1,now()-interval '2 days')",
    );
    await db.query("set role service_role");
    assert.equal(await scalar(db, "select booking_cleanup_limits()"), "1");
  });
  await test("soft archive widget with requests retains history/FKs", async () => {
    await identity(db);
    await db.query("select widget_v2_remove($1,1)", [widget.id]);
    assert.equal(
      await scalar(db, "select widget_v2_config($1)", [widget.public_id]),
      null,
    );
    await db.query("reset role");
    assert.equal(
      await scalar(db, "select count(*)::int from widget_private.requests"),
      155,
    );
  });
  }
  await mkdir(new URL("../../test-results/", import.meta.url), {
    recursive: true,
  });
  await writeFile(
    new URL("../../test-results/booking-postgres.json", import.meta.url),
    JSON.stringify(
      { version: await scalar(db, "select version()"), results },
      null,
      2,
    ),
  );
  console.log(
    "PASS",
    results.length,
    "real PostgreSQL test groups; multi-session TCP, synthetic only",
  );
} finally {
  await db.end();
}
