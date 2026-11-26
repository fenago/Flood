// Console auth with Supabase access tokens (owner decision 2026-11-26: Supabase Auth replaces the password gate).
//
// Every console request carries `Authorization: Bearer <supabase access token>`. We never verify the JWT
// ourselves (no secret here): we ask Supabase with GET {SUPABASE_URL}/auth/v1/user, which works for legacy
// and asymmetric JWT keys. Only after Supabase answers 200 for this exact token do we read its claims.
//
// Fail closed: malformed -> 401; Supabase rejects -> 401; Supabase down / slow (5 s) / 5xx / 429 -> 503,
// never allow. Successful verifications are cached in memory for <= 60 s keyed by SHA-256(token).
// The raw token is never logged, stored in Blobs, or put in any response.
// Claims reference: https://supabase.com/docs/guides/auth/jwt-fields (amr[].timestamp, session_id, sub).
import { createHash, createHmac, hkdfSync } from "node:crypto";
import { env, jsonError } from "./http.mjs";
import { deps } from "./deps.mjs";

export const AUTH_CACHE_TTL_MS = 60 * 1000;
export const AUTH_CACHE_MAX = 500;
export const REAUTH_WINDOW_MS = 15 * 60 * 1000;
const CLOCK_SKEW_MS = 2 * 60 * 1000;
const BEARER = /^Bearer ([A-Za-z0-9_-]{8,2048}\.[A-Za-z0-9_-]{8,4096}\.[A-Za-z0-9_-]{8,1024})$/;

const cache = new Map(); // sha256(token) hex -> { user, claims, until }
export function _resetAuthCache() { cache.clear(); }

const tokenKey = (token) => createHash("sha256").update(token).digest("hex");

export function adminEmails() {
  return (env("CONSOLE_ADMIN_EMAILS") ?? "").split(",").map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));
}

export function supabaseBase() {
  const raw = (env("SUPABASE_URL") ?? "").trim().replace(/\/+$/, "");
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash) return null;
    return u.origin + u.pathname.replace(/\/+$/, "");
  } catch { return null; }
}

/** Decode the payload of a token Supabase has ALREADY accepted. Never used to make a trust decision alone. */
function decodeClaims(token) {
  try { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); } catch { return null; }
}

const unauth = () => ({ response: jsonError(401, "unauthenticated", "Sign in again") });
const unavailable = () => ({ response: jsonError(503, "auth_unavailable", "Sign-in service unavailable, try again shortly", { retryAfterSeconds: 10 }) });

/**
 * Verify the bearer token with Supabase. Returns { user, claims } or { response } (401/503).
 * Does NOT check confirmation or admin status: see requireAdmin.
 */
export async function verifyBearer(req) {
  const m = BEARER.exec(req.headers.get("authorization") ?? "");
  if (!m) return unauth();
  const token = m[1];
  const key = tokenKey(token);
  const nowMs = deps.now().getTime();
  const hit = cache.get(key);
  if (hit && hit.until > nowMs) return { user: hit.user, claims: hit.claims };
  if (hit) cache.delete(key);

  const base = supabaseBase();
  const apikey = env("SUPABASE_PUBLISHABLE_KEY");
  if (!base || !apikey) return { response: jsonError(503, "not_configured", "console not configured") };
  let res;
  try {
    res = await deps.fetch(`${base}/auth/v1/user`, {
      method: "GET",
      headers: { apikey, authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(deps.authTimeoutMs ?? 5000),
      redirect: "error",
    });
  } catch {
    return unavailable(); // network error or 5 s timeout: never allow
  }
  if (res.status >= 500 || res.status === 429) return unavailable();
  if (res.status !== 200) return unauth();
  let user;
  try { user = await res.json(); } catch { return unavailable(); }
  const claims = decodeClaims(token);
  // Defensive: the user Supabase returned must be the token's subject, and an authenticated (not anon) user.
  if (!user || typeof user.id !== "string" || !claims || claims.sub !== user.id || (claims.role && claims.role !== "authenticated")) return unauth();

  // Cache <= 60 s and never past the token's own expiry.
  const expMs = Number.isFinite(claims.exp) ? claims.exp * 1000 : nowMs + AUTH_CACHE_TTL_MS;
  const until = Math.min(nowMs + AUTH_CACHE_TTL_MS, expMs);
  if (until > nowMs) {
    if (cache.size >= AUTH_CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { user, claims, until });
  }
  return { user, claims };
}

export const emailConfirmed = (user) => Boolean(user?.email_confirmed_at || user?.confirmed_at);
export const isAdminEmail = (email) => typeof email === "string" && adminEmails().includes(email.trim().toLowerCase());

function banned(user) {
  const t = Date.parse(user?.banned_until ?? "");
  return Number.isFinite(t) && t > deps.now().getTime();
}

/**
 * Bearer token -> Supabase user that is confirmed, not banned and listed in CONSOLE_ADMIN_EMAILS.
 * Returns { user, claims, email } or { response } (401/403/503).
 */
export async function requireAdmin(req) {
  const v = await verifyBearer(req);
  if (v.response) return v;
  if (banned(v.user)) return { response: jsonError(403, "forbidden", "This account cannot use the console") };
  if (!emailConfirmed(v.user)) return { response: jsonError(403, "email_unconfirmed", "confirm your email") };
  if (!isAdminEmail(v.user.email)) return { response: jsonError(403, "not_admin", "This account is not a console admin") };
  return { ...v, email: v.user.email.trim().toLowerCase() };
}

/**
 * State-changing requests: method must not be GET/HEAD; when Origin is present it must equal the site origin
 * exactly ("null" rejected); when Sec-Fetch-Site is present it must be same-origin. Bearer tokens are not
 * sent automatically by browsers, so this is defence in depth, not the main CSRF control.
 */
export function originOk(req) {
  if (req.method === "GET" || req.method === "HEAD") return false;
  const origin = req.headers.get("origin");
  if (origin !== null && origin !== new URL(req.url).origin) return false;
  const sfs = req.headers.get("sec-fetch-site");
  return sfs === null || sfs === "same-origin";
}

/** Origin check + admin token, for POST endpoints. */
export async function requireAdminWrite(req) {
  if (!originOk(req)) return { response: jsonError(403, "origin_rejected", "Request blocked") };
  return requireAdmin(req);
}

/**
 * Approve needs a recent sign-in: Supabase last_sign_in_at within 15 min AND, when the token carries amr
 * claims, this session's newest sign-in method timestamp within 15 min (amr is per session, so an older
 * token cannot ride on a newer sign-in elsewhere). token_refresh entries do not count as a sign-in.
 */
export function recentlySignedIn(user, claims) {
  const now = deps.now().getTime();
  const fresh = (ms) => Number.isFinite(ms) && now - ms <= REAUTH_WINDOW_MS && ms - now <= CLOCK_SKEW_MS;
  if (!fresh(Date.parse(user?.last_sign_in_at ?? ""))) return false;
  if (Array.isArray(claims?.amr) && claims.amr.length) {
    const ts = claims.amr.filter((a) => a && a.method !== "token_refresh" && Number.isFinite(a.timestamp)).map((a) => a.timestamp * 1000);
    if (!ts.length || !fresh(Math.max(...ts))) return false;
  }
  return true;
}

/**
 * Pseudonymous per-IP key for Blobs rate-limit counters. SESSION_SECRET is gone, so the HMAC key is derived
 * with HKDF from the server-only ANTHROPIC_API_KEY (domain-separated label; the derived key reveals nothing
 * about the API key). Rotating that key just resets the counters. Reviewed item for security-engineer.
 */
export function ipHash(context) {
  const ikm = env("ANTHROPIC_API_KEY") ?? "";
  const key = Buffer.from(hkdfSync("sha256", ikm || "unconfigured", "flood-watch", "ip-hash:v1", 32));
  return createHmac("sha256", key).update(`ip:${context?.ip ?? "unknown"}`).digest("hex").slice(0, 32);
}
