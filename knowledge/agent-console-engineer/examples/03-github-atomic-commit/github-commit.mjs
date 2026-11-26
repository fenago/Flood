// Atomic multi-file commit through the GitHub Git Data API, with a stale-base check.
// get ref -> get commit (tree) -> stale check -> create tree -> create commit -> update ref (force:false)
// A 422 from the ref update means the branch moved: start again once from the top.
// Docs: docs.github.com/en/rest/git/{refs,trees,commits} and /rest/repos/contents

export class StaleBaseError extends Error {
  constructor(paths) { super(`stale base: ${paths.join(", ")} changed since the proposal`); this.status = 409; this.paths = paths; }
}
export class GitHubError extends Error {
  constructor(status, body, where) { super(`GitHub ${status} at ${where}: ${body?.message ?? ""}`); this.status = status; }
}

export function makeGitHub({ token, apiBase = "https://api.github.com", fetchImpl = fetch }) {
  return async function gh(method, path, body) {
    const res = await fetchImpl(apiBase + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2026-03-10",
        "user-agent": "flood-watch-agent-console",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    return { status: res.status, json };
  };
}

async function blobShaAt(gh, owner, repo, path, ref) {
  const enc = path.split("/").map(encodeURIComponent).join("/");
  const r = await gh("GET", `/repos/${owner}/${repo}/contents/${enc}?ref=${ref}`);
  if (r.status === 404) return null; // file did not exist at that commit
  if (r.status !== 200) throw new GitHubError(r.status, r.json, `contents ${path}`);
  return r.json.sha;
}

/**
 * files: [{ path, content }]  (already allow-listed and re-validated at approve time)
 * baseSha: the commit the agent read when it made the proposal
 */
export async function commitFiles({ gh, owner, repo, branch = "main", baseSha, files, message }, attempt = 1) {
  const R = `/repos/${owner}/${repo}`;

  const ref = await gh("GET", `${R}/git/ref/heads/${branch}`);
  if (ref.status !== 200) throw new GitHubError(ref.status, ref.json, "get ref");
  const headSha = ref.json.object.sha;

  const head = await gh("GET", `${R}/git/commits/${headSha}`);
  if (head.status !== 200) throw new GitHubError(head.status, head.json, "get commit");
  const treeSha = head.json.tree.sha;

  if (baseSha && headSha !== baseSha) {
    const changed = [];
    for (const f of files) {
      const [a, b] = await Promise.all([
        blobShaAt(gh, owner, repo, f.path, baseSha),
        blobShaAt(gh, owner, repo, f.path, headSha),
      ]);
      if (a !== b) changed.push(f.path);
    }
    if (changed.length) throw new StaleBaseError(changed);
  }

  const tree = await gh("POST", `${R}/git/trees`, {
    base_tree: treeSha,
    tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })),
  });
  if (tree.status !== 201) throw new GitHubError(tree.status, tree.json, "create tree");

  const commit = await gh("POST", `${R}/git/commits`, { message, tree: tree.json.sha, parents: [headSha] });
  if (commit.status !== 201) throw new GitHubError(commit.status, commit.json, "create commit");

  const upd = await gh("PATCH", `${R}/git/refs/heads/${branch}`, { sha: commit.json.sha, force: false });
  if (upd.status === 422 && attempt === 1) {
    // Branch moved between our GET and PATCH (not a fast-forward). Retry once from step 1.
    return commitFiles({ gh, owner, repo, branch, baseSha, files, message }, 2);
  }
  if (upd.status !== 200) throw new GitHubError(upd.status, upd.json, "update ref");
  return { commitSha: commit.json.sha, parent: headSha, attempts: attempt };
}
