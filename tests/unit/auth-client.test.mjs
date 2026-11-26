// src/auth/client.js with a fake Supabase client: no network, never the real project.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

globalThis.location = { origin: "https://my-flood-21.netlify.app" };
const A = await import("../../src/auth/client.js");

const CFG = { supabaseUrl: "https://ygdswggaxtyzlcscgdrf.supabase.co", publishableKey: "sb_publishable_test" };
let calls, handlers, fake, createArgs;

function setup(authOver = {}, cfg = CFG) {
  calls = []; handlers = [];
  const rec = (name, ret) => async (...a) => { calls.push([name, ...a]); return typeof ret === "function" ? ret(...a) : ret; };
  fake = { auth: {
    signUp: rec("signUp", { data: { user: {}, session: null }, error: null }),
    signInWithPassword: rec("signIn", { data: { session: { access_token: "tok", user: { email: "a@b.co" } } }, error: null }),
    signInWithOAuth: rec("oauth", { data: { url: "x" }, error: null }),
    signOut: rec("signOut", { error: null }),
    resetPasswordForEmail: rec("reset", { data: {}, error: null }),
    updateUser: rec("update", { data: {}, error: null }),
    getSession: rec("getSession", { data: { session: { access_token: "tok" } }, error: null }),
    onAuthStateChange: (cb) => { handlers.push(cb); return { data: { subscription: { unsubscribe: () => calls.push(["unsub"]) } } }; },
    ...authOver,
  } };
  A.__configure({
    loadConfig: async () => cfg,
    loadLib: async () => ({ createClient: (...a) => { createArgs = a; return fake; } }),
  });
}
beforeEach(() => setup());

test("createClient gets url, key, PKCE + persist + detectSessionInUrl", async () => {
  await A.init();
  assert.equal(createArgs[0], CFG.supabaseUrl);
  assert.equal(createArgs[1], CFG.publishableKey);
  assert.deepEqual(createArgs[2], { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } });
});

test("signUp sends emailRedirectTo = origin + '/' and reports needsConfirmation", async () => {
  const r = await A.signUp("  a@b.co ", "password1");
  assert.deepEqual(r, { ok: true, needsConfirmation: true });
  assert.deepEqual(calls[0], ["signUp", { email: "a@b.co", password: "password1", options: { emailRedirectTo: "https://my-flood-21.netlify.app/" } }]);
});

test("signUp with an immediate session (confirmation off) needs no confirmation", async () => {
  setup({ signUp: async () => ({ data: { session: { access_token: "t" } }, error: null }) });
  assert.deepEqual(await A.signUp("a@b.co", "password1"), { ok: true, needsConfirmation: false });
});

test("signIn returns the session; wrong password and unconfirmed email map to codes", async () => {
  const ok = await A.signIn("a@b.co", "pw123456");
  assert.equal(ok.ok, true); assert.equal(ok.session.access_token, "tok");
  assert.deepEqual(calls[0], ["signIn", { email: "a@b.co", password: "pw123456" }]);
  setup({ signInWithPassword: async () => ({ data: {}, error: { code: "invalid_credentials", message: "Invalid login credentials", status: 400 } }) });
  assert.deepEqual(await A.signIn("a@b.co", "bad"), { ok: false, code: "invalid_credentials" });
  setup({ signInWithPassword: async () => ({ data: {}, error: { code: "email_not_confirmed", message: "Email not confirmed" } }) });
  assert.deepEqual(await A.signIn("a@b.co", "x"), { ok: false, code: "email_not_confirmed" });
});

test("signInWithGoogle uses provider google and redirectTo origin + '/'", async () => {
  assert.deepEqual(await A.signInWithGoogle(), { ok: true });
  assert.deepEqual(calls[0], ["oauth", { provider: "google", options: { redirectTo: "https://my-flood-21.netlify.app/" } }]);
});

test("signOut and resetPassword and updatePassword", async () => {
  assert.deepEqual(await A.signOut(), { ok: true });
  assert.deepEqual(await A.resetPassword("a@b.co"), { ok: true });
  assert.deepEqual(calls[1], ["reset", "a@b.co", { redirectTo: "https://my-flood-21.netlify.app/" }]);
  assert.deepEqual(await A.updatePassword("newpass12"), { ok: true });
  assert.deepEqual(calls[2], ["update", { password: "newpass12" }]);
});

test("getSession / getAccessToken; null when signed out", async () => {
  assert.equal(await A.getAccessToken(), "tok");
  setup({ getSession: async () => ({ data: { session: null }, error: null }) });
  assert.equal(await A.getSession(), null);
  assert.equal(await A.getAccessToken(), null);
});

test("network failures (thrown or returned) map to 'network'; rate limits and weak passwords too", async () => {
  setup({ signInWithPassword: async () => { throw new TypeError("Failed to fetch"); } });
  assert.deepEqual(await A.signIn("a@b.co", "x"), { ok: false, code: "network" });
  setup({ signInWithPassword: async () => ({ data: {}, error: { name: "AuthRetryableFetchError", status: 0, message: "x" } }) });
  assert.equal((await A.signIn("a@b.co", "x")).code, "network");
  setup({ signUp: async () => ({ data: {}, error: { code: "over_email_send_rate_limit", status: 429 } }) });
  assert.equal((await A.signUp("a@b.co", "password1")).code, "rate_limited");
  setup({ signUp: async () => ({ data: {}, error: { code: "weak_password" } }) });
  assert.equal((await A.signUp("a@b.co", "password1")).code, "weak_password");
  setup({ signUp: async () => ({ data: {}, error: { message: "boom" } }) });
  assert.equal((await A.signUp("a@b.co", "password1")).code, "unknown");
});

test("library failing to load -> every helper reports 'unavailable' and nothing throws", async () => {
  A.__configure({ loadConfig: async () => CFG, loadLib: async () => { throw new Error("404 /vendor/supabase.mjs"); } });
  assert.equal(await A.isAvailable(), false);
  for (const r of [await A.signUp("a@b.co", "password1"), await A.signIn("a@b.co", "x"), await A.signInWithGoogle(), await A.signOut(), await A.resetPassword("a@b.co"), await A.updatePassword("password1")]) {
    assert.deepEqual(r, { ok: false, code: "unavailable" });
  }
  assert.equal(await A.getSession(), null);
  assert.equal(await A.getAccessToken(), null);
  assert.equal(typeof A.onAuthChange(() => {}), "function");
});

test("missing or malformed config -> unavailable; a later retry can succeed", async () => {
  setup({}, { supabaseUrl: "http://insecure", publishableKey: "k" });
  assert.equal(await A.isAvailable(), false);
  A.__configure({ loadConfig: async () => { throw new Error("404"); } });
  assert.equal(await A.isAvailable(), false);
  setup();
  assert.equal(await A.isAvailable(), true);
});

test("onAuthChange forwards events and unsubscribes; cancelling before load subscribes nothing", async () => {
  const seen = [];
  const off = A.onAuthChange((e, s) => seen.push([e, s]));
  await A.init(); await new Promise((r) => setImmediate(r));
  handlers[0]("SIGNED_IN", { a: 1 });
  assert.deepEqual(seen, [["SIGNED_IN", { a: 1 }]]);
  off(); assert.deepEqual(calls.at(-1), ["unsub"]);
  setup();
  A.onAuthChange(() => {})(); // cancelled immediately
  await A.init(); await new Promise((r) => setImmediate(r));
  assert.equal(handlers.length, 0);
});
