// In-memory mock of the GitHub endpoints commitFiles() uses. Fake SHAs, no network.
import http from "node:http";
import { createHash } from "node:crypto";

const sha = (s) => createHash("sha1").update(s).digest("hex");

export function startMockGitHub(initialFiles) {
  const blobs = new Map();   // blobSha -> content
  const trees = new Map();   // treeSha -> Map(path -> blobSha)
  const commits = new Map(); // commitSha -> { tree, parents, message }
  const refs = new Map();
  const log = [];
  let racePending = false;   // when true, the next PATCH sees a moved branch once

  const putTree = (entries) => {
    const s = sha(JSON.stringify([...entries].sort()));
    trees.set(s, entries);
    return s;
  };
  const putCommit = (tree, parents, message) => {
    const s = sha(tree + parents.join() + message + commits.size);
    commits.set(s, { tree, parents, message });
    return s;
  };
  const commitFilesDirect = (files, message) => {
    const head = refs.get("heads/main");
    const entries = new Map(head ? trees.get(commits.get(head).tree) : []);
    for (const [p, c] of Object.entries(files)) { const b = sha("blob " + c); blobs.set(b, c); entries.set(p, b); }
    const c = putCommit(putTree(entries), head ? [head] : [], message);
    refs.set("heads/main", c);
    return c;
  };
  commitFilesDirect(initialFiles, "initial");

  const server = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : null;
    const url = new URL(req.url, "http://x");
    log.push(`${req.method} ${url.pathname}`);
    const reply = (status, json) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(json)); };
    if (!/^Bearer /.test(req.headers.authorization || "")) return reply(401, { message: "Bad credentials" });
    if (req.headers["x-github-api-version"] !== "2026-03-10") return reply(400, { message: "unexpected version" });

    let m;
    if (req.method === "GET" && (m = url.pathname.match(/^\/repos\/[^/]+\/[^/]+\/git\/ref\/(.+)$/))) {
      const s = refs.get(m[1]);
      return s ? reply(200, { ref: `refs/${m[1]}`, object: { type: "commit", sha: s } }) : reply(404, { message: "Not Found" });
    }
    if (req.method === "GET" && (m = url.pathname.match(/\/git\/commits\/([0-9a-f]+)$/))) {
      const c = commits.get(m[1]);
      return c ? reply(200, { sha: m[1], tree: { sha: c.tree }, parents: c.parents.map((p) => ({ sha: p })), message: c.message }) : reply(404, { message: "Not Found" });
    }
    if (req.method === "GET" && (m = url.pathname.match(/^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/))) {
      const path = decodeURIComponent(m[1]);
      const c = commits.get(url.searchParams.get("ref"));
      const b = c && trees.get(c.tree).get(path);
      return b ? reply(200, { type: "file", path, sha: b }) : reply(404, { message: "Not Found" });
    }
    if (req.method === "POST" && url.pathname.endsWith("/git/trees")) {
      const entries = new Map(trees.get(body.base_tree) || []);
      for (const e of body.tree) {
        if (e.sha === null) { entries.delete(e.path); continue; }
        const b = sha("blob " + e.content); blobs.set(b, e.content); entries.set(e.path, b);
      }
      return reply(201, { sha: putTree(entries) });
    }
    if (req.method === "POST" && url.pathname.endsWith("/git/commits")) {
      return reply(201, { sha: putCommit(body.tree, body.parents, body.message), tree: { sha: body.tree } });
    }
    if (req.method === "PATCH" && (m = url.pathname.match(/\/git\/refs\/(.+)$/))) {
      if (racePending) { racePending = false; commitFilesDirect({ "README.md": "someone else pushed" }, "race"); }
      const current = refs.get(m[1]);
      const parents = commits.get(body.sha)?.parents ?? [];
      if (!body.force && !parents.includes(current)) return reply(422, { message: "Update is not a fast forward" });
      refs.set(m[1], body.sha);
      return reply(200, { ref: `refs/${m[1]}`, object: { type: "commit", sha: body.sha } });
    }
    reply(404, { message: "Not Found" });
  });

  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => server.close(),
    log,
    head: () => refs.get("heads/main"),
    fileAtHead: (p) => blobs.get(trees.get(commits.get(refs.get("heads/main")).tree).get(p)),
    pushDirect: commitFilesDirect,
    armRace: () => { racePending = true; },
  })));
}
