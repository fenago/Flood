// Profile helpers: pure validation/sanitising (src/auth/profile.js) and getProfile/saveProfile with a fake Supabase client.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProfile, prefillFrom, validateProfile, cleanName, NAME_MAX } from "../../src/auth/profile.js";

globalThis.location = { origin: "https://my-flood-21.netlify.app" };
const A = await import("../../src/auth/client.js");
const IDS = ["miami", "miami-beach", "key-west"];

test("parseProfile trims, caps at 50, strips control chars, and rejects unknown city/units", () => {
  const p = parseProfile({ first_name: "  Ana\n\t Maria ", last_name: "B".repeat(80), home_city_id: "atlantis", units: "kelvin" }, IDS);
  assert.deepEqual(p, { firstName: "Ana Maria", lastName: "B".repeat(NAME_MAX), homeCityId: "", units: null });
  assert.deepEqual(parseProfile({ home_city_id: "key-west", units: "metric" }, IDS), { firstName: "", lastName: "", homeCityId: "key-west", units: "metric" });
  assert.deepEqual(parseProfile(null, IDS), { firstName: "", lastName: "", homeCityId: "", units: null });
  assert.equal(parseProfile({ first_name: 42 }, IDS).firstName, "");
  assert.equal(parseProfile({ home_city_id: "miami" }).homeCityId, ""); // no city list -> nothing is trusted
});

test("markup stays plain text (it is only ever rendered with textContent)", () => {
  assert.equal(cleanName("<img src=x onerror=alert(1)>"), "<img src=x onerror=alert(1)>");
});

test("prefillFrom: given/family names win, else split full_name or name", () => {
  assert.deepEqual(prefillFrom({ given_name: "Ana", family_name: "Ruiz", full_name: "X Y" }), { firstName: "Ana", lastName: "Ruiz" });
  assert.deepEqual(prefillFrom({ full_name: "María José Lopez" }), { firstName: "María", lastName: "José Lopez" });
  assert.deepEqual(prefillFrom({ name: "Cher" }), { firstName: "Cher", lastName: "" });
  assert.deepEqual(prefillFrom({}), { firstName: "", lastName: "" });
});

test("validateProfile rules", () => {
  const ok = validateProfile({ firstName: " Ana ", lastName: "", homeCityId: "miami", units: "us" }, IDS);
  assert.deepEqual(ok, { ok: true, value: { firstName: "Ana", lastName: "", homeCityId: "miami", units: "us" } });
  assert.equal(validateProfile({ firstName: "  " }, IDS).code, "first_name_required");
  assert.equal(validateProfile({ firstName: "A".repeat(51) }, IDS).code, "first_name_too_long");
  assert.equal(validateProfile({ firstName: "A", lastName: "B".repeat(51) }, IDS).code, "last_name_too_long");
  assert.equal(validateProfile({ firstName: "A", homeCityId: "atlantis" }, IDS).code, "invalid_city");
  assert.equal(validateProfile({ firstName: "A", units: "stone" }, IDS).code, "invalid_units");
  assert.equal(validateProfile({ firstName: "A", homeCityId: "" }, IDS).value.units, "us");
  assert.equal(validateProfile({ firstName: "A".repeat(50) }, IDS).ok, true);
});

function fakeClient(over = {}) {
  const calls = [];
  const fake = { auth: {
    getSession: async () => ({ data: { session: { user: { user_metadata: { first_name: "Ana", given_name: "G", home_city_id: "miami", units: "metric" } } } }, error: null }),
    updateUser: async (a) => { calls.push(a); return { data: { user: { user_metadata: a.data } }, error: null }; },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    ...over,
  } };
  A.__configure({ loadConfig: async () => ({ supabaseUrl: "https://x.supabase.co", publishableKey: "k" }), loadLib: async () => ({ createClient: () => fake }) });
  return calls;
}

test("getProfile reads user_metadata and never throws", async () => {
  fakeClient();
  const r = await A.getProfile(IDS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.profile, { firstName: "Ana", lastName: "", homeCityId: "miami", units: "metric" });
  fakeClient({ getSession: async () => ({ data: { session: null }, error: null }) });
  assert.deepEqual(await A.getProfile(IDS), { ok: false, code: "no_session" });
  fakeClient({ getSession: async () => { throw new TypeError("Failed to fetch"); } });
  assert.deepEqual(await A.getProfile(IDS), { ok: false, code: "network" });
});

test("saveProfile validates first (no request when invalid) and sends metadata only", async () => {
  const calls = fakeClient();
  const bad = await A.saveProfile({ firstName: "", homeCityId: "miami" }, IDS);
  assert.deepEqual(bad, { ok: false, code: "first_name_required", field: "firstName" });
  assert.equal((await A.saveProfile({ firstName: "A", homeCityId: "nope" }, IDS)).code, "invalid_city");
  assert.equal(calls.length, 0);
  const r = await A.saveProfile({ firstName: " Ana ", lastName: "Ruiz", homeCityId: "miami", units: "us" }, IDS);
  assert.deepEqual(calls, [{ data: { first_name: "Ana", last_name: "Ruiz", home_city_id: "miami", units: "us" } }]);
  assert.deepEqual(r, { ok: true, profile: { firstName: "Ana", lastName: "Ruiz", homeCityId: "miami", units: "us" } });
});

test("saveProfile maps service errors and never throws", async () => {
  fakeClient({ updateUser: async () => ({ data: null, error: { name: "AuthRetryableFetchError", message: "x", status: 0 } }) });
  assert.deepEqual(await A.saveProfile({ firstName: "A" }, IDS), { ok: false, code: "network" });
  fakeClient({ updateUser: async () => { throw new Error("boom"); } });
  assert.equal((await A.saveProfile({ firstName: "A" }, IDS)).code, "unknown");
});

test("storedSession reads a persisted supabase-js session without the network", () => {
  const ls = { "sb-abc-auth-token": JSON.stringify({ user: { email: "a@b.co" } }), other: "x" };
  Object.defineProperty(ls, "getItem", { value: (k) => ls[k] ?? null }); // like real Storage: keys enumerate, methods do not
  globalThis.localStorage = ls;
  assert.equal(A.storedSession()?.user?.email, "a@b.co");
  ls["sb-abc-auth-token"] = "not json";
  assert.equal(A.storedSession(), null);
  delete globalThis.localStorage;
  assert.equal(A.storedSession(), null);
});
