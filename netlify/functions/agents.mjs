// GET /api/agents - agent cards (name, description, model, personality). Session required.
import { requireConfigured } from "../lib/configured.mjs";
import { json } from "../lib/http.mjs";
import { requireSession } from "../lib/session.mjs";
import { rateLimit } from "../lib/ratelimit.mjs";
import { listAgents } from "../lib/agents.mjs";

export const config = { path: "/api/agents", method: "GET" };

export default async (req, context) => {
  const off = requireConfigured(); // fail closed before any Blobs, Claude or GitHub access
  if (off) return off;
  const limited = await rateLimit("agents", context);
  if (limited) return limited;
  const auth = await requireSession(req, context);
  if (auth.response) return auth.response;
  return json(200, { agents: listAgents() });
};
