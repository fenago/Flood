#!/usr/bin/env node
// Validates .claude/agents/*.md and .claude/skills/*/SKILL.md frontmatter and wiring.
// Usage: node validate-agents.mjs [repoRoot] [configDir=.claude]   (exit 1 if any ERROR)
// configDir lets the fixture in model-files/ use "claude/" instead of ".claude/", so
// Claude Code never loads the example skill as a real nested project skill.
// Rules come from code.claude.com/docs/en/sub-agents, /skills and the project's
// agent-authoring skill. Project conventions are tagged [project].
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { load } from "js-yaml";

const root = process.argv[2] ?? process.cwd();
const cfg = process.argv[3] ?? ".claude";
const agentsDir = join(root, cfg, "agents");
const skillsDir = join(root, cfg, "skills");

const AGENT_FIELDS = new Set(["name", "description", "tools", "disallowedTools", "model", "permissionMode",
  "maxTurns", "autoCompactWindow", "skills", "mcpServers", "hooks", "memory", "background", "omitClaudeMd",
  "effort", "isolation", "color", "initialPrompt", "experimental"]);
const PROJECT_AGENT_FIELDS = new Set(["personality"]);
const SKILL_FIELDS = new Set(["name", "description", "when_to_use", "argument-hint", "arguments",
  "disable-model-invocation", "user-invocable", "allowed-tools", "disallowed-tools", "model", "effort",
  "context", "agent", "background", "hooks", "paths", "shell", "metadata", "license", "compatibility"]);
const MODELS = new Set(["sonnet", "opus", "haiku", "fable", "inherit"]);
const COLORS = new Set(["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"]);
const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const PERMISSION_MODES = new Set(["default", "acceptEdits", "auto", "dontAsk", "bypassPermissions", "plan", "manual"]);

const out = { error: [], warn: [], info: [] };
const report = (level, file, msg) => out[level].push(`${file}: ${msg}`);

function parse(file) {
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) { report("error", file, "no YAML frontmatter between --- lines"); return null; }
  try {
    const fm = load(m[1]);
    if (!fm || typeof fm !== "object") throw new Error("frontmatter is not a map");
    return { fm, body: m[2], lines: text.split("\n").length };
  } catch (e) { report("error", file, `YAML error: ${e.message.split("\n")[0]}`); return null; }
}
const list = (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,\s]+/).filter(Boolean) : []);

// ---- skills ----
const skills = new Map();
for (const dir of existsSync(skillsDir) ? readdirSync(skillsDir, { withFileTypes: true }) : []) {
  if (!dir.isDirectory()) continue;
  const file = join(cfg, "skills", dir.name, "SKILL.md");
  if (!existsSync(join(root, file))) { report("error", `${cfg}/skills/${dir.name}`, "missing SKILL.md"); continue; }
  const p = parse(join(root, file));
  if (!p) continue;
  const { fm, lines } = p;
  skills.set(dir.name, fm);
  const name = fm.name ?? dir.name;
  if (fm.name && fm.name !== dir.name) report("error", file, `[project] name "${fm.name}" != directory "${dir.name}"`);
  if (!/^[a-z0-9-]{1,64}$/.test(name)) report("warn", file, `name "${name}" is not lowercase-hyphen (<=64)`);
  if (!fm.description) report("error", file, "missing description");
  const listing = `${fm.description ?? ""}${fm.when_to_use ? " " + fm.when_to_use : ""}`;
  if (listing.length > 1536) report("warn", file, `description+when_to_use is ${listing.length} chars; listing truncates at 1,536`);
  if (lines >= 500) report("warn", file, `${lines} lines; keep SKILL.md under 500`);
  for (const k of ["disable-model-invocation", "user-invocable"])
    if (k in fm && typeof fm[k] !== "boolean") report("error", file, `${k} must be true/false`);
  if (fm.effort && !EFFORTS.has(fm.effort)) report("error", file, `effort "${fm.effort}" not in ${[...EFFORTS]}`);
  if (fm.context && fm.context !== "fork") report("error", file, `context must be "fork"`);
  for (const k of Object.keys(fm)) if (!SKILL_FIELDS.has(k)) report("warn", file, `unknown field "${k}" (ignored by Claude Code)`);
}

// ---- agents ----
const used = new Set();
const agentFiles = existsSync(agentsDir) ? readdirSync(agentsDir).filter((f) => f.endsWith(".md")) : [];
const names = new Set();
for (const f of agentFiles) {
  const file = join(cfg, "agents", f);
  const p = parse(join(root, file));
  if (!p) continue;
  const { fm, body } = p;
  if (!fm.name) report("error", file, "missing name");
  else {
    if (String(fm.name).includes(":")) report("error", file, "name must not contain ':'");
    if (String(fm.name).length > 256) report("error", file, "name longer than 256 chars");
    if (!/^[a-z0-9-]+$/.test(fm.name)) report("warn", file, "[project] name should be lowercase-hyphen");
    if (basename(f, ".md") !== fm.name) report("warn", file, `[project] file name != name "${fm.name}"`);
    if (names.has(fm.name)) report("error", file, `duplicate agent name "${fm.name}"`);
    names.add(fm.name);
  }
  if (!fm.description) report("error", file, "missing description");
  if (fm.model && !MODELS.has(fm.model) && !/^claude-[a-z0-9-]+$/.test(fm.model))
    report("error", file, `model "${fm.model}" is not an alias or a claude-* ID`);
  if (fm.color && !COLORS.has(fm.color)) report("error", file, `color "${fm.color}" not in ${[...COLORS]}`);
  if (fm.effort && !EFFORTS.has(fm.effort)) report("error", file, `effort "${fm.effort}" not in ${[...EFFORTS]}`);
  if (fm.permissionMode && !PERMISSION_MODES.has(fm.permissionMode)) report("error", file, `bad permissionMode "${fm.permissionMode}"`);
  if (fm.isolation && fm.isolation !== "worktree") report("error", file, `isolation must be "worktree"`);
  if (fm.memory && !["user", "project", "local"].includes(fm.memory)) report("error", file, `memory must be user|project|local`);
  for (const k of Object.keys(fm))
    if (!AGENT_FIELDS.has(k) && !PROJECT_AGENT_FIELDS.has(k)) report("warn", file, `unknown field "${k}" (Claude Code ignores it silently)`);

  const sk = list(fm.skills);
  const distinct = [...new Set(sk)];
  if (distinct.length !== sk.length) report("warn", file, "duplicate entries in skills");
  if (distinct.length > 32) report("warn", file, `${distinct.length} skills; only the first 32 distinct names preload`);
  for (const s of distinct) {
    used.add(s);
    const sfm = skills.get(s);
    if (!sfm) report("error", file, `skills: "${s}" has no ${cfg}/skills/${s}/SKILL.md`);
    else if (sfm["disable-model-invocation"] === true) report("error", file, `skills: "${s}" sets disable-model-invocation: true, so it cannot be preloaded`);
  }

  // [project] only the orchestrator may delegate
  const denied = list(fm.disallowedTools);
  if (fm.name !== "orchestrator" && !denied.includes("Agent")) report("error", file, "[project] expert must have disallowedTools: Agent");
  if (fm.name === "orchestrator" && denied.includes("Agent")) report("error", file, "[project] orchestrator must be able to use Agent");
  if (!/^## Handoff/m.test(body) && !/Handoff/.test(body)) report("warn", file, "[project] body has no Handoff report format");

  // [project] knowledge folder wiring (agent-authoring skill)
  if (fm.name) {
    const kdir = join(root, "knowledge", fm.name);
    if (!existsSync(join(kdir, "README.md"))) report("warn", file, `[project] knowledge/${fm.name}/README.md missing`);
    const hits = body.match(/^#+\s*Before you answer/gm) ?? [];
    if (hits.length !== 1) report("warn", file, `[project] expected exactly one "Before you answer" section, found ${hits.length}`);
    else if (!body.includes(`knowledge/${fm.name}/`)) report("warn", file, `[project] "Before you answer" does not point at knowledge/${fm.name}/`);
  }
}

for (const s of skills.keys()) if (!used.has(s)) report("info", `${cfg}/skills/${s}`, "not preloaded by any agent");

const rosterPath = join(root, "docs/expert-roster.md");
if (existsSync(rosterPath)) {
  const roster = readFileSync(rosterPath, "utf8");
  for (const n of names) if (!roster.includes(`\`${n}\``)) report("warn", "docs/expert-roster.md", `agent "${n}" not mentioned`);
}

console.log(`agents: ${agentFiles.length}, skills: ${skills.size}, skills preloaded somewhere: ${used.size}`);
for (const level of ["error", "warn", "info"]) {
  console.log(`${level.toUpperCase()}S: ${out[level].length}`);
  for (const m of out[level]) console.log(`  ${level}: ${m}`);
}
process.exit(out.error.length ? 1 : 0);
