// Allow-list attack table (ported from knowledge/security-engineer/examples/allowlist.test.mjs) + read checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pathProblem, validateProposal, readPathProblem } from "../../netlify/lib/allowlist.mjs";

// [input, expected reason or null for accepted]
export const CASES = [
  // accepted
  ["public/index.html", null],
  ["public/config/scoring.json", null],
  ["public/icons/icon-192.svg", null],
  ["public/manifest.webmanifest", null],
  ["src/scoring/flood.mjs", null],
  ["tests/scoring/flood.test.mjs", null], // inner dot allowed (docs/04 regex would reject this)
  ["docs/decisions.md", null],
  // traversal and encodings (OWASP Path Traversal page)
  ["../netlify.toml", "dot-dot"],
  ["public/../netlify.toml", "dot-dot"],
  ["public/..\\netlify.toml", "dot-dot"],
  ["public\\index.html", "backslash"],
  ["public/%2e%2e/netlify.toml", "percent-encoding"],
  ["public/..%2fnetlify.toml", "dot-dot"],
  ["public/%252e%252e%255cx.js", "percent-encoding"],
  ["public/..%c0%afx.js", "dot-dot"],
  ["/etc/passwd", "absolute"],
  ["/public/index.html", "absolute"],
  ["public//index.html", "empty segment"],
  ["docs/a.md\u0000.js", "control char"],
  ["docs/a\nb.md", "control char"],
  // hidden and privileged files
  [".env", "hidden segment"],
  ["public/.env.js", "hidden segment"],
  [".claude/agents/orchestrator.md", "hidden segment"],
  [".github/workflows/ci.yml", "hidden segment"],
  ["netlify.toml", "denied path"],
  ["netlify/functions/lib/allowlist.mjs", "denied path"],
  ["package.json", "denied path"],
  ["package-lock.json", "denied path"],
  ["scripts/build-agents-manifest.mjs", "denied path"],
  ["public/sw.js", "denied path"],
  ["CLAUDE.md", "denied path"],
  ["knowledge/security-engineer/docs/01-session-management-cookies.md", "denied path"],
  ["public/_headers", "denied path"],
  ["public/_redirects.json", "denied path"],
  // shape tricks
  ["Public/index.html", "not on allow-list"],
  ["src/x.JS", "not on allow-list"],
  ["public/index.html ", "not on allow-list"],
  ["publіc/index.html", "not on allow-list"], // Cyrillic i (U+0456)
  ["docs/café.md", "not NFC"],           // e + combining acute (NFD)
  ["public/evil.php", "not on allow-list"],
  ["public/", "not on allow-list"],
  ["README.md", "not on allow-list"],
  ["", "empty"],
];

test("path table", () => {
  for (const [input, want] of CASES) assert.equal(pathProblem(input), want, JSON.stringify(input));
});

test("proposal-level limits", () => {
  const ok = { files: [{ path: "docs/a.md", content: "# hi\n" }] };
  assert.deepEqual(validateProposal(ok), []);
  const many = { files: Array.from({ length: 11 }, (_, i) => ({ path: `docs/f${i}.md`, content: "x" })) };
  assert.ok(validateProposal(many).some((m) => m.includes("more than 10")));
  const big = { files: [{ path: "docs/big.md", content: "x".repeat(200 * 1024 + 1) }] };
  assert.ok(validateProposal(big).some((m) => m.includes("> 204800")));
  const dup = { files: [{ path: "docs/a.md", content: "1" }, { path: "docs/a.md", content: "2" }] };
  assert.ok(validateProposal(dup).some((m) => m.includes("duplicate")));
  const nul = { files: [{ path: "docs/a.md", content: "a\u0000b" }] };
  assert.ok(validateProposal(nul).some((m) => m.includes("NUL")));
  const surrogate = { files: [{ path: "docs/a.md", content: "bad \ud800 text" }] };
  assert.ok(validateProposal(surrogate).some((m) => m.includes("lone surrogate")));
  const bin = { files: [{ path: "docs/a.md", content: { not: "text" } }] };
  assert.ok(validateProposal(bin).some((m) => m.includes("content not text")));
  assert.deepEqual(validateProposal({ files: [] }), ["no files"]);
});


test("extra write attacks: Netlify functions, unicode tricks, deny wins over allow", () => {
  for (const p of ["netlify/functions/agent-chat.mjs", "netlify/lib/allowlist.mjs", "public/_headers", "public/sw.js",
    "src/../netlify.toml", "docs/‮md.js", "public/index.html​", "tests/x.test.mjs/../../netlify.toml", ".claude/skills/x/SKILL.md"]) {
    assert.notEqual(pathProblem(p), null, JSON.stringify(p));
  }
});

test("read allow-list: wider than writes, but never secrets or server code", () => {
  for (const p of ["README.md", "CLAUDE.md", "docs/decisions.md", "src/scoring/flood.js", "knowledge/flood-risk-scientist/README.md",
    ".claude/agents/orchestrator.md", ".claude/skills/path-allowlist/SKILL.md"]) assert.equal(readPathProblem(p), null, p);
  for (const [p, why] of [[".env", "hidden segment"], [".env.production", "hidden segment"], ["public/.env.js", "hidden segment"],
    [".claude/agents/.env", "hidden segment"], [".claude/settings.local.json", "hidden segment"], [".github/workflows/ci.yml", "hidden segment"],
    ["netlify/lib/auth.mjs", "denied path"], ["netlify.toml", "denied path"], ["package-lock.json", "denied path"],
    ["../etc/passwd", "dot-dot"], [".claude/../.env", "dot-dot"], ["docs/%2e%2e/x.md", "percent-encoding"], ["/README.md", "absolute"]]) {
    assert.equal(readPathProblem(p), why, p);
  }
});
