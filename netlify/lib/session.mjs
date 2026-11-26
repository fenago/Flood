// Console auth: scrypt password hash, HMAC-signed __Host- session cookie, session records in Blobs,
// signed session-bound CSRF token, Origin / Sec-Fetch-Site checks.
// Reference: knowledge/security-engineer/examples/session-auth.mjs (tested) + console-auth-sessions skill.
import { scrypt, randomBytes, createHmac, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { env, jsonError } from "./http.mjs";
import { openStore, StorageError } from "./blobs.mjs";
import { deps } from "./deps.mjs";

const scryptAsync = promisify(scrypt);
export const SCRYPT = { N: 2 ** 17, r: 8, p: 1, keylen: 32, saltBytes: 16 };
const maxmemFor = (N, r) => 128 * N * r + 32 * 1024 * 1024; // OWASP N=2^17,r=8 needs ~128 MiB > Node default 32 MiB

export async function hashPassword(password, opts = SCRYPT) {
  if (typeof password !== "string" || password.length === 0) throw new TypeError("password required");
  const salt = randomBytes(opts.saltBytes);
  const key = await scryptAsync(password.normalize("NFC"), salt, opts.keylen, { N: opts.N, r: opts.r, p: opts.p, maxmem: maxmemFor(opts.N, opts.r) });
  return ["scrypt", opts.N, opts.r, opts.p, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Constant-time verify; false (never throws) for malformed or weakened stored hashes. */
export async function verifyPassword(password, stored) {
  const parts = typeof stored === "string" ? stored.split("$") : [];
  if (parts.length !== 6 || parts[0] !== "scrypt" || typeof password !== "string" || password.length > 1024) return false;
  const [, nS, rS, pS, saltB64, hashB64] = parts;
  const N = Number(nS), r = Number(rS), p = Number(pS);
  if (!(N >= 2 ** 15 && N <= 2 ** 20 && (N & (N - 1)) === 0 && r === 8 && p >= 1 && p <= 4)) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  if (salt.length < 16 || expected.length !== 32) return false;
  const actual = await scryptAsync(password.normalize("NFC"), salt, expected.length, { N, r, p, maxmem: maxmemFor(N, r) });
  return timingSafeEqual(actual, expected);
}

export const COOKIE_NAME = "__Host-fw_session";
export const SESSION_MAX_AGE = 8 * 60 * 60; // 28800 s
export const REAUTH_WINDOW_MS = 15 * 60 * 1000;

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const hmac = (secret, label, value) => createHmac("sha256", secret).update(`${label}:${value}`).digest();
const safeEqual = (a, b) => a.length === b.length && timingSafeEqual(a, b);

export const newSessionId = () => b64url(randomBytes(32));
export const sessionKey = (id) => `sessions/${createHash("sha256").update(id).digest("hex")}`;
export const signSessionId = (id, secret) => `${id}.${b64url(hmac(secret, "session", id))}`;

export function verifySignedSessionId(value, secret) {
  if (typeof value !== "string" || value.length > 200) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1), "base64url");
  return safeEqual(given, hmac(secret, "session", id)) ? id : null;
}

export const sessionCookie = (signed) => `${COOKIE_NAME}=${signed}; Max-Age=${SESSION_MAX_AGE}; Path=/; Secure; HttpOnly; SameSite=Strict`;
export const clearSessionCookie = () => `${COOKIE_NAME}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict`;

// CSRF (skill console-auth-sessions): token = r "." HMAC(secret, "csrf:" + sessionId + ":" + r).
export function newCsrfToken(sessionId, secret) {
  const r = b64url(randomBytes(16));
  return `${r}.${b64url(hmac(secret, "csrf", `${sessionId}:${r}`))}`;
}
export function csrfTokenValid(token, sessionId, secret) {
  if (typeof token !== "string" || token.length > 200) return false;
  const [r, sig, extra] = token.split(".");
  if (!r || !sig || extra !== undefined) return false;
  return safeEqual(Buffer.from(sig, "base64url"), hmac(secret, "csrf", `${sessionId}:${r}`));
}

export function readCookie(req, name) {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** Same-origin check for state-changing requests: Origin must equal this request's own origin. */
export function originOk(req) {
  if (req.method === "GET" || req.method === "HEAD") return false;
  const origin = req.headers.get("origin");
  if (!origin || origin === "null" || origin !== new URL(req.url).origin) return false;
  const sfs = req.headers.get("sec-fetch-site");
  return sfs === null || sfs === "same-origin";
}

export function sessionSecret() {
  const s = env("SESSION_SECRET");
  return typeof s === "string" && s.length >= 32 ? s : null;
}

export function ipHash(context, secret) {
  return createHmac("sha256", secret ?? "no-secret").update(`ip:${context?.ip ?? "unknown"}`).digest("hex").slice(0, 32);
}

/**
 * Verify cookie signature, then the server-side record and expiry.
 * Returns { session } or { response } (401/503) for the caller to return.
 */
export async function requireSession(req, context) {
  const secret = sessionSecret();
  if (!secret) return { response: jsonError(503, "not_configured", "Console is not configured") };
  const id = verifySignedSessionId(readCookie(req, COOKIE_NAME), secret);
  if (!id) return { response: jsonError(401, "unauthenticated", "Sign in again") };
  try {
    const store = openStore("sessions", context);
    const rec = await store.get(sessionKey(id));
    if (!rec || Date.parse(rec.expiresAt) <= deps.now().getTime()) return { response: jsonError(401, "unauthenticated", "Sign in again") };
    return { session: { id, record: rec, secret } };
  } catch (e) {
    if (e instanceof StorageError) return { response: jsonError(503, "storage_unavailable", "Try again shortly") };
    throw e;
  }
}

/** Session + Origin + CSRF for POSTs. Returns { session } or { response }. */
export async function requireWrite(req, context) {
  if (!originOk(req)) return { response: jsonError(403, "csrf_failed", "Request blocked") };
  const s = await requireSession(req, context);
  if (s.response) return s;
  if (!csrfTokenValid(req.headers.get("x-csrf-token"), s.session.id, s.session.secret)) return { response: jsonError(403, "csrf_failed", "Request blocked") };
  return s;
}
