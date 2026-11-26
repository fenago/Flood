// POST /api/auth-login {password} -> __Host-fw_session cookie + CSRF token.
// Netlify rule (1 of 2) + REQUIRED Blobs lockout (10 failures / 15 min per IP) covering the ~10 s rule delay.
import { requireConfigured } from "../lib/configured.mjs";
import { json, jsonError, env, readJsonBody } from "../lib/http.mjs";
import { verifyPassword, newSessionId, sessionKey, signSessionId, sessionCookie, newCsrfToken, originOk, sessionSecret, ipHash, SESSION_MAX_AGE } from "../lib/session.mjs";
import { openStore, incrementCounter, StorageError } from "../lib/blobs.mjs";
import { deps } from "../lib/deps.mjs";

export const config = {
  path: "/api/auth-login",
  method: "POST",
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ["ip", "domain"] }, // Netlify rule 1 of 2
};

const LOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

export default async (req, context) => {
  const off = requireConfigured(); // fail closed before any Blobs, Claude or GitHub access
  if (off) return off;
  if (req.method !== "POST") return jsonError(405, "method_not_allowed", "POST only", {}, { allow: "POST" });
  if (!originOk(req)) return jsonError(403, "csrf_failed", "Request blocked");
  const secret = sessionSecret();
  const stored = env("CONSOLE_PASSWORD_HASH");
  if (!secret || !stored) return jsonError(503, "not_configured", "Console is not configured");
  const { body, error } = await readJsonBody(req, 4096);
  if (error) return error;
  if (typeof body.password !== "string" || body.password.length === 0 || body.password.length > 1024) return jsonError(400, "bad_request", "Password required");

  try {
    const counters = openStore("counters", context);
    const win = Math.floor(deps.now().getTime() / LOCK_WINDOW_MS);
    const lockKey = `lockout/${ipHash(context, secret)}/${win}`;
    const fails = (await counters.get(lockKey))?.n ?? 0;
    if (fails >= MAX_FAILURES) {
      return jsonError(429, "rate_limited", "Too many failed sign-ins. Wait 15 minutes.", { retryAfterSeconds: Math.ceil(LOCK_WINDOW_MS / 1000 - (deps.now().getTime() % LOCK_WINDOW_MS) / 1000) });
    }
    if (!(await verifyPassword(body.password, stored))) {
      await incrementCounter(counters, lockKey);
      return jsonError(401, "wrong_password", "Wrong password");
    }
    const id = newSessionId();
    const now = deps.now();
    const rec = { createdAt: now.toISOString(), authAt: now.toISOString(), expiresAt: new Date(now.getTime() + SESSION_MAX_AGE * 1000).toISOString(), ipHash: ipHash(context, secret) };
    const r = await openStore("sessions", context).setJSON(sessionKey(id), rec, { onlyIfNew: true });
    if (!r?.modified) return jsonError(503, "storage_unavailable", "Try again", { retryAfterSeconds: 2 });
    return json(200, { ok: true, csrfToken: newCsrfToken(id, secret), expiresAt: rec.expiresAt }, { "set-cookie": sessionCookie(signSessionId(id, secret)) });
  } catch (e) {
    if (e instanceof StorageError) return jsonError(503, "storage_unavailable", "Try again shortly", { retryAfterSeconds: 5 });
    return jsonError(500, "internal", "Something went wrong");
  }
};
