// Run: node --test knowledge/security-engineer/examples/session-auth.test.mjs
// All secrets below are obviously fake test values.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import {
  hashPassword, verifyPassword, newSessionId, signSessionId, verifySignedSessionId,
  sessionCookie, clearSessionCookie, sessionKey, csrfTokenFor, checkCsrf, readCookie, COOKIE_NAME,
} from "./session-auth.mjs";

const SECRET = "TEST-ONLY-session-secret-not-real-0000000000";
const ORIGIN = "https://floodwatch.example";

test("Node default maxmem rejects OWASP scrypt N=2^17 (why we raise maxmem)", () => {
  assert.throws(() => scryptSync("x", "saltsaltsaltsalt", 32, { N: 2 ** 17, r: 8, p: 1 }));
});

test("hash format and verify", async () => {
  const h = await hashPassword("correct horse battery staple");
  assert.match(h, /^scrypt\$131072\$8\$1\$[A-Za-z0-9+/=]{24}\$[A-Za-z0-9+/=]{44}$/);
  assert.equal(await verifyPassword("correct horse battery staple", h), true);
  assert.equal(await verifyPassword("correct horse battery stapl", h), false);
  assert.equal(await verifyPassword("", h), false);
});

test("two hashes of the same password differ (random salt)", async () => {
  assert.notEqual(await hashPassword("pw-test-1"), await hashPassword("pw-test-1"));
});

test("malformed or downgraded stored hashes are rejected without throwing", async () => {
  const h = await hashPassword("pw-test-2");
  const p = h.split("$");
  for (const bad of [
    undefined, "", "plaintext", h.replace("scrypt", "bcrypt"),
    [p[0], 1024, p[2], p[3], p[4], p[5]].join("$"),          // N too small
    [p[0], 131071, p[2], p[3], p[4], p[5]].join("$"),        // not power of two
    [p[0], p[1], p[2], p[3], "c2FsdA==", p[5]].join("$"),     // salt < 16 bytes
    [p[0], p[1], p[2], p[3], p[4], "AAAA"].join("$"),         // wrong hash length
  ]) assert.equal(await verifyPassword("pw-test-2", bad), false, String(bad));
});

test("session id: 256-bit, signed, tamper-evident", () => {
  const id = newSessionId();
  assert.equal(Buffer.from(id, "base64url").length, 32);
  const signed = signSessionId(id, SECRET);
  assert.equal(verifySignedSessionId(signed, SECRET), id);
  assert.equal(verifySignedSessionId(signed, SECRET + "x"), null);           // wrong key
  assert.equal(verifySignedSessionId(signed.slice(0, -2) + "AA", SECRET), null); // bad mac
  assert.equal(verifySignedSessionId(newSessionId() + signed.slice(signed.indexOf(".")), SECRET), null); // swapped id
  assert.equal(verifySignedSessionId("nodot", SECRET), null);
  assert.equal(verifySignedSessionId(signed + ".x", SECRET), null);
  assert.match(sessionKey(id), /^sessions\/[0-9a-f]{64}$/);
  assert.ok(!sessionKey(id).includes(id));
});

test("cookie attributes", () => {
  const c = sessionCookie(signSessionId(newSessionId(), SECRET));
  for (const attr of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Max-Age=28800"]) assert.ok(c.includes(attr), attr);
  assert.ok(c.startsWith("__Host-"));
  assert.ok(!/Domain=/i.test(c)); // __Host- forbids Domain
  assert.match(clearSessionCookie(), /Max-Age=0/);
});

test("CSRF: session-bound token + Origin + Sec-Fetch-Site", () => {
  const sid = newSessionId();
  const token = csrfTokenFor(sid, SECRET);
  const mk = (h, method = "POST") => new Request(`${ORIGIN}/api/proposal-approve`, {
    method, headers: Object.fromEntries(Object.entries(h).filter(([, v]) => v !== undefined)),
  });
  const ok = { origin: ORIGIN, "sec-fetch-site": "same-origin", "x-csrf-token": token };
  const ctx = { sessionId: sid, secret: SECRET, siteOrigin: ORIGIN };
  assert.equal(checkCsrf(mk(ok), ctx), true);
  assert.equal(checkCsrf(mk({ ...ok, "sec-fetch-site": undefined }), ctx), true); // older browser: header absent
  assert.equal(checkCsrf(mk({ ...ok, origin: "https://evil.example" }), ctx), false);
  assert.equal(checkCsrf(mk({ ...ok, "sec-fetch-site": "cross-site" }), ctx), false);
  assert.equal(checkCsrf(mk({ ...ok, "x-csrf-token": csrfTokenFor(newSessionId(), SECRET) }), ctx), false); // other session's token
  assert.equal(checkCsrf(mk({ origin: ORIGIN }), ctx), false);                   // missing token
  assert.equal(checkCsrf(mk(ok, "GET"), ctx), false);                            // GET never state-changing
});

test("readCookie parses a cookie header", () => {
  const req = new Request(ORIGIN, { headers: { cookie: `a=1; ${COOKIE_NAME}=abc.def; b=2` } });
  assert.equal(readCookie(req, COOKIE_NAME), "abc.def");
  assert.equal(readCookie(req, "missing"), null);
});
