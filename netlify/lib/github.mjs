// GitHub REST for the console: read files at a commit, list the tree, and one atomic multi-file commit
// (Git Data API) with a stale-base check. Token: fine-grained PAT, one repo, Contents read/write only.
// Reference: knowledge/agent-console-engineer/examples/03-github-atomic-commit (tested with a mock).
import { deps } from "./deps.mjs";
import { env } from "./http.mjs";

export const GITHUB_API_VERSION = "2026-03-10";
export class StaleBaseError extends Error {
  constructor(paths) { super(`stale base: ${paths.join(", ")} changed since the proposal`); this.status = 409; this.paths = paths; }
}
export class GitHubError extends Error {
  constructor(status, where) { super(`GitHub ${status} at ${where}`); this.status = status; }
}

export function githubConfig() {
  const token = env("GITHUB_TOKEN");
  const repo = env("GITHUB_REPO") ?? "";
  const branch = env("GITHUB_BRANCH") || "main";
  const m = /^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/.exec(repo);
  if (!token || !m || !/^[A-Za-z0-9._/-]{1,100}$/.test(branch) || branch.includes("..")) return null;
  return { token, owner: m[1], repo: m[2], branch };
}

export function makeGitHub({ token }) {
  return async function gh(method, path, body) {
    const res = await deps.fetch(deps.githubApiBase + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": GITHUB_API_VERSION,
        "user-agent": "flood-watch-agent-console",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    return { status: res.status, json };
  };
}

const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");

export async function headSha(gh, { owner, repo, branch }) {
  const r = await gh("GET", `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  if (r.status !== 200) throw new GitHubError(r.status, "get ref");
  return r.json.object.sha;
}

/** File text at a commit, or null if it does not exist. */
export async function readFileAt(gh, { owner, repo }, path, ref) {
  const r = await gh("GET", `/repos/${owner}/${repo}/contents/${encPath(path)}?ref=${encodeURIComponent(ref)}`);
  if (r.status === 404) return null;
  if (r.status !== 200 || r.json?.type !== "file") throw new GitHubError(r.status, `contents ${path}`);
  if (r.json.encoding !== "base64" || typeof r.json.content !== "string") throw new GitHubError(r.status, `contents ${path} (too large or not base64)`);
  return Buffer.from(r.json.content, "base64").toString("utf8");
}

export async function listTree(gh, { owner, repo }, ref) {
  const c = await gh("GET", `/repos/${owner}/${repo}/git/commits/${ref}`);
  if (c.status !== 200) throw new GitHubError(c.status, "get commit");
  const t = await gh("GET", `/repos/${owner}/${repo}/git/trees/${c.json.tree.sha}?recursive=1`);
  if (t.status !== 200) throw new GitHubError(t.status, "get tree");
  return (t.json.tree ?? []).filter((e) => e.type === "blob").map((e) => e.path);
}

async function blobShaAt(gh, owner, repo, path, ref) {
  const r = await gh("GET", `/repos/${owner}/${repo}/contents/${encPath(path)}?ref=${encodeURIComponent(ref)}`);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new GitHubError(r.status, `contents ${path}`);
  return r.json.sha;
}

/** get ref -> get commit -> stale check -> tree -> commit -> update ref (force:false); one retry on 422. */
export async function commitFiles({ gh, owner, repo, branch, baseSha, files, message }, attempt = 1) {
  const R = `/repos/${owner}/${repo}`;
  const ref = await gh("GET", `${R}/git/ref/heads/${branch}`);
  if (ref.status !== 200) throw new GitHubError(ref.status, "get ref");
  const head = ref.json.object.sha;
  const commit = await gh("GET", `${R}/git/commits/${head}`);
  if (commit.status !== 200) throw new GitHubError(commit.status, "get commit");
  if (baseSha && head !== baseSha) {
    const changed = [];
    for (const f of files) {
      const [a, b] = await Promise.all([blobShaAt(gh, owner, repo, f.path, baseSha), blobShaAt(gh, owner, repo, f.path, head)]);
      if (a !== b) changed.push(f.path);
    }
    if (changed.length) throw new StaleBaseError(changed);
  }
  const tree = await gh("POST", `${R}/git/trees`, { base_tree: commit.json.tree.sha, tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })) });
  if (tree.status !== 201) throw new GitHubError(tree.status, "create tree");
  const created = await gh("POST", `${R}/git/commits`, { message, tree: tree.json.sha, parents: [head] });
  if (created.status !== 201) throw new GitHubError(created.status, "create commit");
  const upd = await gh("PATCH", `${R}/git/refs/heads/${branch}`, { sha: created.json.sha, force: false });
  if (upd.status === 422 && attempt === 1) return commitFiles({ gh, owner, repo, branch, baseSha, files, message }, 2);
  if (upd.status !== 200) throw new GitHubError(upd.status, "update ref");
  return { commitSha: created.json.sha, parent: head, attempts: attempt };
}
