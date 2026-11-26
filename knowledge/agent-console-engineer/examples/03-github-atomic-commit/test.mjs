// Verifies commitFiles() against the local mock: happy path, stale base, and ref race.
import assert from "node:assert/strict";
import { startMockGitHub } from "./mock-github.mjs";
import { commitFiles, makeGitHub, StaleBaseError } from "./github-commit.mjs";

const gh0 = await startMockGitHub({ "public/index.html": "<title>Old</title>", "docs/decisions.md": "# Decisions\n" });
const gh = makeGitHub({ token: "test-not-a-real-token", apiBase: gh0.url });
const common = { gh, owner: "fenago", repo: "Flood" };

// 1) Happy path: two files in ONE commit.
let base = gh0.head();
const r1 = await commitFiles({ ...common, baseSha: base, message: "agent(pwa): fix title\n\nProposal-Id: p_1",
  files: [{ path: "public/index.html", content: "<title>Flood Watch</title>" }, { path: "docs/decisions.md", content: "# Decisions\n- title\n" }] });
assert.equal(gh0.head(), r1.commitSha);
assert.equal(r1.parent, base);
assert.equal(gh0.fileAtHead("public/index.html"), "<title>Flood Watch</title>");
console.log("1 happy path: commit", r1.commitSha.slice(0, 7), "parent", base.slice(0, 7), "attempts", r1.attempts);

// 2) Stale base: someone changed a proposed file after the agent read it -> 409, no commit.
base = gh0.head();
gh0.pushDirect({ "public/index.html": "<title>Human edit</title>" }, "human");
const before = gh0.head();
await assert.rejects(
  commitFiles({ ...common, baseSha: base, message: "agent: stale", files: [{ path: "public/index.html", content: "x" }] }),
  (e) => e instanceof StaleBaseError && e.status === 409 && e.paths[0] === "public/index.html",
);
assert.equal(gh0.head(), before);
console.log("2 stale base: rejected with 409, head unchanged");

// 3) Base moved but proposed files untouched -> commit on top of new head.
base = gh0.head();
gh0.pushDirect({ "README.md": "unrelated" }, "human 2");
const r3 = await commitFiles({ ...common, baseSha: base, message: "agent: docs", files: [{ path: "docs/decisions.md", content: "# D\n" }] });
assert.equal(gh0.head(), r3.commitSha);
console.log("3 unrelated change on main: committed on new head");

// 4) Race: branch moves between create-commit and PATCH -> 422 -> one retry succeeds.
gh0.armRace();
const r4 = await commitFiles({ ...common, baseSha: gh0.head(), message: "agent: race", files: [{ path: "docs/decisions.md", content: "# D2\n" }] });
assert.equal(r4.attempts, 2);
assert.equal(gh0.fileAtHead("README.md"), "someone else pushed");
assert.equal(gh0.fileAtHead("docs/decisions.md"), "# D2\n");
console.log("4 ref race: 422 then retry, attempts =", r4.attempts);

gh0.close();
console.log("requests:", gh0.log.length, "| PATCH calls:", gh0.log.filter((l) => l.startsWith("PATCH")).length);
console.log("PASS 03-github-atomic-commit");
