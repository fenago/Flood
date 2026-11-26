// POST /api/auth-logout - deletes the session record and clears the cookie. Session + CSRF required.
import { json } from "../lib/http.mjs";
import { requireWrite, sessionKey, clearSessionCookie } from "../lib/session.mjs";
import { openStore } from "../lib/blobs.mjs";
import { rateLimit } from "../lib/ratelimit.mjs";

export const config = { path: "/api/auth-logout", method: "POST" };

export default async (req, context) => {
  const limited = await rateLimit("auth-logout", context);
  if (limited) return limited;
  const auth = await requireWrite(req, context);
  if (auth.response) return auth.response;
  await openStore("sessions", context).delete(sessionKey(auth.session.id));
  return json(200, { ok: true }, { "set-cookie": clearSessionCookie() });
};
