// In-memory mock of the GitHub REST endpoints the console uses (refs, commits, trees, contents).
// Exposed as a fetch() implementation, so no port is needed. Fake SHAs, no network.
import { createHash } from "node:crypto";
const sha = (s) => createHash("sha1").update(s).digest("hex");

export function mockGitHub(initialFiles, { owner = "test-owner", repo = "flood" } = {}) {
  const blobs = new Map(), trees = new Map(), commits = new Map(), refs = new Map();
  const log = [];
  let raceOnce = false;
  let failNext = null;
  const putTree = (entries) => { const s = sha(JSON.stringify([...entries].sort())); trees.set(s, entries); return s; };
  const putCommit = (tree, parents, message) => { const s = sha(tree + parents.join() + message + commits.size); commits.set(s, { tree, parents, message }); return s; };
  const push = (files, message) => {
    const head = refs.get("heads/main");
    const entries = new Map(head ? trees.get(commits.get(head).tree) : []);
    for (const [p, c] of Object.entries(files)) { const b = sha("blob " + c); blobs.set(b, c); entries.set(p, b); }
    const c = putCommit(putTree(entries), head ? [head] : [], message);
    refs.set("heads/main", c);
    return c;
  };
  push(initialFiles, "initial");
  const prefix = `/repos/${owner}/${repo}`;

  async function fetchImpl(url, init = {}) {
    const u = new URL(url);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    log.push({ method, path: u.pathname, headers: init.headers });
    const reply = (status, json) => new Response(status === 204 ? null : JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
    const h = init.headers ?? {};
    if (!/^Bearer \S+/.test(h.authorization ?? "")) return reply(401, { message: "Bad credentials" });
    if (h["x-github-api-version"] !== "2026-03-10") return reply(400, { message: "unexpected version" });
    if (failNext && method === failNext.method) { const s = failNext.status; failNext = null; return reply(s, { message: "boom" }); }
    if (!u.pathname.startsWith(prefix)) return reply(404, { message: "Not Found" });
    const p = u.pathname.slice(prefix.length);
    let m;
    if (method === "GET" && (m = p.match(/^\/git\/ref\/(.+)$/))) {
      const s = refs.get(m[1]);
      return s ? reply(200, { object: { sha: s } }) : reply(404, { message: "Not Found" });
    }
    if (method === "GET" && (m = p.match(/^\/git\/commits\/([0-9a-f]+)$/))) {
      const c = commits.get(m[1]);
      return c ? reply(200, { sha: m[1], tree: { sha: c.tree }, parents: c.parents.map((x) => ({ sha: x })) }) : reply(404, { message: "Not Found" });
    }
    if (method === "GET" && (m = p.match(/^\/git\/trees\/([0-9a-f]+)$/))) {
      const t = trees.get(m[1]);
      return t ? reply(200, { tree: [...t].map(([path, b]) => ({ path, type: "blob", sha: b })) }) : reply(404, { message: "Not Found" });
    }
    if (method === "GET" && (m = p.match(/^\/contents\/(.+)$/))) {
      const path = decodeURIComponent(m[1]);
      const c = commits.get(u.searchParams.get("ref"));
      const b = c && trees.get(c.tree).get(path);
      return b ? reply(200, { type: "file", path, sha: b, encoding: "base64", content: Buffer.from(blobs.get(b)).toString("base64") }) : reply(404, { message: "Not Found" });
    }
    if (method === "POST" && p === "/git/trees") {
      const entries = new Map(trees.get(body.base_tree) || []);
      for (const e of body.tree) { const b = sha("blob " + e.content); blobs.set(b, e.content); entries.set(e.path, b); }
      return reply(201, { sha: putTree(entries) });
    }
    if (method === "POST" && p === "/git/commits") return reply(201, { sha: putCommit(body.tree, body.parents, body.message) });
    if (method === "PATCH" && (m = p.match(/^\/git\/refs\/(.+)$/))) {
      if (raceOnce) { raceOnce = false; push({ "README.md": "someone else pushed" }, "race"); }
      const current = refs.get(m[1]);
      if (!body.force && !(commits.get(body.sha)?.parents ?? []).includes(current)) return reply(422, { message: "Update is not a fast forward" });
      refs.set(m[1], body.sha);
      return reply(200, { object: { sha: body.sha } });
    }
    return reply(404, { message: "Not Found" });
  }
  return {
    fetch: fetchImpl, log, owner, repo,
    head: () => refs.get("heads/main"),
    fileAtHead: (path) => { const b = trees.get(commits.get(refs.get("heads/main")).tree).get(path); return b ? blobs.get(b) : null; },
    commitMessage: (s) => commits.get(s)?.message,
    push, armRace: () => { raceOnce = true; }, failNext: (method, status) => { failNext = { method, status }; },
    writes: () => log.filter((l) => l.method !== "GET").length,
  };
}
