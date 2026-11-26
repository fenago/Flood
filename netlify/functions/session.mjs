// GET /api/session - is the cookie valid? Returns a fresh CSRF token (kept in memory by the console).
import { json } from "../lib/http.mjs";
import { requireSession, newCsrfToken } from "../lib/session.mjs";
import { rateLimit } from "../lib/ratelimit.mjs";

export const config = { path: "/api/session", method: "GET" };

export default async (req, context) => {
  const limited = await rateLimit("session", context);
  if (limited) return limited;
  const auth = await requireSession(req, context);
  if (auth.response) return auth.response;
  return json(200, { ok: true, csrfToken: newCsrfToken(auth.session.id, auth.session.secret), expiresAt: auth.session.record.expiresAt });
};
