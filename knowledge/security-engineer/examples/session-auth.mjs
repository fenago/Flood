// Worked example: console password hash, constant-time verify, HMAC-signed
// session cookie and a session-bound CSRF token. Node 22, node:crypto only.
//
// Maps to .claude/skills/console-auth-sessions/SKILL.md. Differences from the
// skill are deliberate and flagged in examples/README.md:
//   - cookie name uses the __Host- prefix (OWASP Session Management + MDN);
//   - the CSRF token is HMAC-bound to the session (OWASP: naive double-submit
//     is "INSECURE").
// In a Netlify Function, read secrets inside the handler and pass them in.
import { scrypt, randomBytes, createHmac, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

// OWASP Password Storage cheat sheet, first scrypt row: N=2^17, r=8, p=1.
// Node's default maxmem is 32 MiB and scrypt throws when ~128*N*r > maxmem,
// so maxmem must be raised (128 * 131072 * 8 = 128 MiB).
export const SCRYPT = { N: 2 ** 17, r: 8, p: 1, keylen: 32, saltBytes: 16 };
const maxmemFor = (N, r) => 128 * N * r + 32 * 1024 * 1024; // headroom

/** Returns "scrypt$N$r$p$saltB64$hashB64" (format from the skill). */
export async function hashPassword(password, opts = SCRYPT) {
  if (typeof password !== "string" || password.length === 0) throw new TypeError("password required");
  const salt = randomBytes(opts.saltBytes);
  const key = await scryptAsync(password.normalize("NFC"), salt, opts.keylen, {
    N: opts.N, r: opts.r, p: opts.p, maxmem: maxmemFor(opts.N, opts.r),
  });
  return ["scrypt", opts.N, opts.r, opts.p, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Constant-time verify. Returns false (never throws) for any malformed stored hash. */
export async function verifyPassword(password, stored) {
  const parts = typeof stored === "string" ? stored.split("$") : [];
  if (parts.length !== 6 || parts[0] !== "scrypt" || typeof password !== "string") return false;
  const [, nS, rS, pS, saltB64, hashB64] = parts;
  const N = Number(nS), r = Number(rS), p = Number(pS);
  // Refuse weak or absurd parameters so a tampered env var cannot downgrade us.
  if (!(N >= 2 ** 15 && N <= 2 ** 20 && (N & (N - 1)) === 0 && r === 8 && p >= 1 && p <= 4)) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  if (salt.length < 16 || expected.length !== 32) return false;
  const actual = await scryptAsync(password.normalize("NFC"), salt, expected.length, { N, r, p, maxmem: maxmemFor(N, r) });
  // timingSafeEqual throws if lengths differ; both are 32 bytes here.
  return timingSafeEqual(actual, expected);
}

// ---- Session ID + cookie -------------------------------------------------
export const COOKIE_NAME = "__Host-fw_session";
export const SESSION_MAX_AGE = 8 * 60 * 60; // 28800 s, matches the skill (OWASP: 4-8 h absolute)

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const hmac = (secret, label, value) => createHmac("sha256", secret).update(`${label}:${value}`).digest();

/** 32 random bytes = 256 bits (OWASP: >= 64 bits, prefer >= 128). */
export function newSessionId() { return b64url(randomBytes(32)); }

/** Blobs key: store only a hash of the ID, so a Blobs leak gives no live cookie. */
export function sessionKey(id) { return `sessions/${createHash("sha256").update(id).digest("hex")}`; }

export function signSessionId(id, secret) { return `${id}.${b64url(hmac(secret, "session", id))}`; }

/** Returns the raw session id if the signature is valid, else null. */
export function verifySignedSessionId(value, secret) {
  if (typeof value !== "string" || value.length > 200) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1), "base64url");
  const want = hmac(secret, "session", id);
  if (given.length !== want.length) return null; // avoid the timingSafeEqual length throw
  return timingSafeEqual(given, want) ? id : null;
}

export function sessionCookie(signedValue) {
  // __Host- requires Secure, Path=/ and no Domain (MDN Set-Cookie).
  return `${COOKIE_NAME}=${signedValue}; Max-Age=${SESSION_MAX_AGE}; Path=/; Secure; HttpOnly; SameSite=Strict`;
}
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

// ---- CSRF: session-bound token (OWASP "signed double-submit") ----------------
export function csrfTokenFor(sessionId, secret) { return b64url(hmac(secret, "csrf", sessionId)); }

/**
 * Check a state-changing request. All three must pass:
 * Origin equals the site origin; Sec-Fetch-Site (if sent) is same-origin;
 * X-CSRF-Token equals HMAC(secret, "csrf:" + sessionId).
 */
export function checkCsrf(req, { sessionId, secret, siteOrigin }) {
  if (req.method === "GET" || req.method === "HEAD") return false; // never state-change on GET
  if (req.headers.get("origin") !== siteOrigin) return false;
  const sfs = req.headers.get("sec-fetch-site");
  if (sfs !== null && sfs !== "same-origin") return false;
  const given = Buffer.from(req.headers.get("x-csrf-token") ?? "", "utf8");
  const want = Buffer.from(csrfTokenFor(sessionId, secret), "utf8");
  return given.length === want.length && timingSafeEqual(given, want);
}

/** Read one cookie from a Request's Cookie header. */
export function readCookie(req, name) {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}
