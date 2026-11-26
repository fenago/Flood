// GET /api/proposals            -> recent proposals (id, summary, status, agent, createdAt)
// GET /api/proposals?id=p_...   -> one proposal with "before" contents (at baseSha) for the diff view
import { requireConfigured } from "../lib/configured.mjs";
import { json, jsonError } from "../lib/http.mjs";
import { requireAdmin } from "../lib/auth.mjs";
import { rateLimit } from "../lib/ratelimit.mjs";
import { openStore } from "../lib/blobs.mjs";
import { githubConfig, makeGitHub, readFileAt } from "../lib/github.mjs";
import { deps } from "../lib/deps.mjs";
import { PROPOSAL_ID } from "../lib/ids.mjs";

export const config = { path: "/api/proposals", method: "GET" };

const view = (p) => ({ id: p.id, summary: p.summary, status: p.status, agent: p.agent, createdAt: p.createdAt, expiresAt: p.expiresAt,
  baseSha: p.baseSha, commitSha: p.commitSha ?? null, commitUrl: p.commitUrl ?? null, lastError: p.lastError ?? null, stalePaths: p.stalePaths ?? null,
  expired: p.status === "pending" && Date.parse(p.expiresAt) < deps.now().getTime() });

export default async (req, context) => {
  const off = requireConfigured(); // fail closed before any Blobs, Claude or GitHub access
  if (off) return off;
  const limited = await rateLimit("proposals", context);
  if (limited) return limited;
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;
  const store = openStore("proposals", context);
  const id = new URL(req.url).searchParams.get("id");
  if (id === null) {
    const keys = (await store.list("p_")).slice(-200);
    const items = (await Promise.all(keys.map((k) => store.get(k)))).filter(Boolean).map(view);
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(200, { proposals: items.slice(0, 20) });
  }
  if (!PROPOSAL_ID.test(id)) return jsonError(400, "bad_request", "Invalid id");
  const p = await store.get(id);
  if (!p) return jsonError(404, "not_found", "No such proposal");
  const cfg = githubConfig();
  const gh = cfg ? makeGitHub(cfg) : null;
  const files = await Promise.all(p.files.map(async (f) => {
    let before = null, beforeError = null;
    try { before = gh ? await readFileAt(gh, cfg, f.path, p.baseSha) : null; if (!gh) beforeError = "GitHub not configured"; }
    catch { beforeError = "Could not load the current file"; }
    return { path: f.path, before, after: f.content, beforeError };
  }));
  return json(200, { proposal: { ...view(p), files } });
};
