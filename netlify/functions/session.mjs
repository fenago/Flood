// GET /api/session - who is this Supabase token? -> { email, isAdmin } (401 for a missing/invalid token).
// Netlify rate-limit rule 1 of 2 (moved here from the removed auth-login). No Blobs access at all.
// Unconfirmed email -> 403 "confirm your email" so the console can tell the owner what to do.
import { requireConfigured } from "../lib/configured.mjs";
import { json, jsonError } from "../lib/http.mjs";
import { verifyBearer, emailConfirmed, isAdminEmail } from "../lib/auth.mjs";

export const config = {
  path: "/api/session",
  method: "GET",
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] }, // Netlify rule 1 of 2
};

export default async (req) => {
  const off = requireConfigured(); // fail closed before any Supabase, Blobs, Claude or GitHub access
  if (off) return off;
  if (req.method !== "GET") return jsonError(405, "method_not_allowed", "GET only", {}, { allow: "GET" });
  const v = await verifyBearer(req);
  if (v.response) return v.response;
  if (!emailConfirmed(v.user)) return jsonError(403, "email_unconfirmed", "confirm your email");
  const email = typeof v.user.email === "string" ? v.user.email.trim().toLowerCase() : null;
  return json(200, { email, isAdmin: isAdminEmail(email) });
};
