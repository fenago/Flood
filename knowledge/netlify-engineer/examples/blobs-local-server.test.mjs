// Checks REAL @netlify/blobs behaviour against its bundled local BlobsServer.
// @netlify/blobs must resolve from the CURRENT directory (kept out of the repo):
//   cd <scratch dir with @netlify/blobs installed> && node --test <repo>/knowledge/netlify-engineer/examples/blobs-local-server.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(process.cwd() + "/");
const { getStore } = require("@netlify/blobs");
const { BlobsServer } = require("@netlify/blobs/server");
const TOKEN = "TEST-ONLY-blobs-token";
let server, dir, url;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "blobs-"));
  server = new BlobsServer({ directory: dir, token: TOKEN });
  url = `http://localhost:${(await server.start()).port}`;
});
after(async () => { await server.stop(); rmSync(dir, { recursive: true, force: true }); });
const store = (extra = {}) => getStore({ name: "jobs", siteID: "test-site", token: TOKEN, edgeURL: url, ...extra });

test("strong consistency needs uncachedEdgeURL in a custom environment", async () => {
  await assert.rejects(store({ consistency: "strong" }).get("k"), { name: "BlobsConsistencyError" });
  assert.equal(await store({ consistency: "strong", uncachedEdgeURL: url }).get("missing"), null);
});

test("onlyIfNew and onlyIfMatch (with an etag from a write) behave as documented", async () => {
  const s = store({ consistency: "strong", uncachedEdgeURL: url });
  const a = await s.setJSON("k1", { v: 1 }, { onlyIfNew: true });
  assert.deepEqual([a.modified, typeof a.etag], [true, "string"]);
  assert.deepEqual(await s.setJSON("k1", { v: 2 }, { onlyIfNew: true }), { modified: false });
  await new Promise((r) => setTimeout(r, 5)); // local etags are mtime-based (ms resolution)
  const b = await s.setJSON("k1", { v: 3 }, { onlyIfMatch: a.etag });
  assert.equal(b.modified, true);
  assert.equal((await s.setJSON("k1", { v: 4 }, { onlyIfMatch: a.etag })).modified, false); // stale
  assert.deepEqual(await s.get("k1", { type: "json" }), { v: 3 });
});

test("GOTCHA: local server returns no etag on reads, and onlyIfMatch: undefined is unconditional", async () => {
  const s = store({ consistency: "strong", uncachedEdgeURL: url });
  await s.setJSON("k2", { v: 1 });
  const r = await s.getWithMetadata("k2", { type: "json" });
  assert.equal(r.etag, undefined);
  const w = await s.setJSON("k2", { v: 2 }, { onlyIfMatch: r.etag }); // looks conditional, is not
  assert.equal(w.modified, true);
});

test("list({ prefix }) and key rules", async () => {
  const s = store({ consistency: "strong", uncachedEdgeURL: url });
  await s.setJSON("2026-11-26/a", { n: 1 });
  await s.setJSON("2026-11-26/b", { n: 2 });
  const { blobs } = await s.list({ prefix: "2026-11-26/" });
  assert.deepEqual(blobs.map((b) => b.key).sort(), ["2026-11-26/a", "2026-11-26/b"]);
  await assert.rejects(s.set("/leading-slash", "x")); // keys cannot start with "/"
});
