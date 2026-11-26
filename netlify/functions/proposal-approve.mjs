// POST /api/proposal-approve {id, password?} - human approval -> one atomic GitHub commit -> Netlify redeploy.
// Re-validates session, Origin, CSRF, recent auth, allow-list and limits; pending -> approving with onlyIfMatch
// so a double click or a replay can never commit twice.
import { requireConfigured } from "../lib/configured.mjs";
import { json, jsonError, env, readJsonBody } from "../lib/http.mjs";
import { requireWrite, verifyPassword, REAUTH_WINDOW_MS } from "../lib/session.mjs";
import { rateLimit } from "../lib/ratelimit.mjs";
import { openStore, casUpdate, StorageError } from "../lib/blobs.mjs";
import { validateProposal } from "../lib/allowlist.mjs";
import { githubConfig, makeGitHub, commitFiles, StaleBaseError } from "../lib/github.mjs";
import { deps } from "../lib/deps.mjs";
import { PROPOSAL_ID } from "../lib/ids.mjs";

export const config = { path: "/api/proposal-approve", method: "POST" };

export default async (req, context) => {
  const off = requireConfigured(); // fail closed before any Blobs, Claude or GitHub access
  if (off) return off;
  const limited = await rateLimit("proposal-approve", context);
  if (limited) return limited;
  const auth = await requireWrite(req, context);
  if (auth.response) return auth.response;
  const { body, error } = await readJsonBody(req, 4096);
  if (error) return error;
  if (typeof body.id !== "string" || !PROPOSAL_ID.test(body.id)) return jsonError(400, "bad_request", "Invalid id");
  if (body.password !== undefined && (typeof body.password !== "string" || body.password.length > 1024)) return jsonError(400, "bad_request", "Invalid password field");

  // Recent auth: signed in within 15 min, or the password typed again now.
  if (typeof body.password === "string" && body.password.length > 0) {
    if (!(await verifyPassword(body.password, env("CONSOLE_PASSWORD_HASH")))) return jsonError(403, "wrong_password", "That password didn't match");
  } else if (deps.now().getTime() - Date.parse(auth.session.record.authAt) > REAUTH_WINDOW_MS) {
    return jsonError(403, "reauth_required", "Type your console password to approve");
  }

  const cfg = githubConfig();
  if (!cfg) return jsonError(503, "not_configured", "GitHub is not configured");
  const store = openStore("proposals", context);
  try {
    const current = await store.get(body.id);
    if (!current) return jsonError(404, "not_found", "No such proposal");
    if (current.status !== "pending") {
      return jsonError(409, "already_processed", `Proposal is ${current.status}`, { status: current.status, commitSha: current.commitSha ?? null, commitUrl: current.commitUrl ?? null });
    }
    if (Date.parse(current.expiresAt) < deps.now().getTime()) return jsonError(410, "expired", "This proposal expired; ask the agent again");
    // Never trust the stored copy blindly: the allow-list and limits run again at approve time.
    const problems = validateProposal(current);
    if (problems.length) return jsonError(400, "proposal_invalid", `Proposal fails the allow-list: ${problems.join("; ")}`);

    const claim = await casUpdate(store, body.id, (p) => (p.status === "pending" ? { ...p, status: "approving", approvingAt: deps.now().toISOString() } : undefined));
    if (!claim.ok) {
      const p = claim.current ?? {};
      return jsonError(409, "already_processed", `Proposal is ${p.status ?? "busy"}`, { status: p.status ?? null, commitSha: p.commitSha ?? null, commitUrl: p.commitUrl ?? null });
    }
    const proposal = claim.value;
    const gh = makeGitHub(cfg);
    const message = `agent(${proposal.agent}): ${proposal.summary}\n\nProposal-Id: ${proposal.id}\nApproved-Via: Flood Watch Agent Console`;
    try {
      const { commitSha } = await commitFiles({ gh, owner: cfg.owner, repo: cfg.repo, branch: cfg.branch, baseSha: proposal.baseSha, files: proposal.files, message });
      const commitUrl = `https://github.com/${cfg.owner}/${cfg.repo}/commit/${commitSha}`;
      await casUpdate(store, body.id, (p) => ({ ...p, status: "committed", commitSha, commitUrl, committedAt: deps.now().toISOString() }));
      return json(200, { ok: true, status: "committed", commitSha, commitUrl });
    } catch (e) {
      if (e instanceof StaleBaseError) {
        await casUpdate(store, body.id, (p) => ({ ...p, status: "stale", stalePaths: e.paths }));
        return jsonError(409, "stale", "The main branch changed since this proposal was made", { paths: e.paths });
      }
      await casUpdate(store, body.id, (p) => ({ ...p, status: "pending", lastError: `commit failed (${e?.status ?? "error"})` }));
      return jsonError(502, "commit_failed", "The commit failed, so nothing changed on the live site");
    }
  } catch (e) {
    if (e instanceof StorageError) return jsonError(503, "storage_unavailable", "Try again shortly", { retryAfterSeconds: 5 });
    return jsonError(500, "internal", "Something went wrong");
  }
};
