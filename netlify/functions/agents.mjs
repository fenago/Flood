// GET /api/agents - agent cards (name, description, model, personality). Admin Supabase token required.
import { requireConfigured } from "../lib/configured.mjs";
import { json } from "../lib/http.mjs";
import { requireAdmin } from "../lib/auth.mjs";
import { rateLimit } from "../lib/ratelimit.mjs";
import { listAgents } from "../lib/agents.mjs";

export const config = { path: "/api/agents", method: "GET" };

export default async (req, context) => {
  const off = requireConfigured(); // fail closed before any Blobs, Claude or GitHub access
  if (off) return off;
  const limited = await rateLimit("agents", context);
  if (limited) return limited;
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;
  return json(200, { agents: listAgents() });
};
