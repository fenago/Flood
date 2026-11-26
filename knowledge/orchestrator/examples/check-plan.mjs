#!/usr/bin/env node
// Validate an orchestrator plan file. Zero dependencies (Node 18+).
// Usage: node check-plan.mjs <plan.json> [--agents <dir>]
// Exit 0 = valid (warnings allowed), 1 = errors, 2 = usage problem.
//
// Rules
//  E1 tasks is a non-empty array; ids unique
//  E2 every task has exactly one owner: a non-empty string naming an agent in .claude/agents
//  E3 dependsOn entries exist and are not the task itself
//  E4 no dependency cycles
//  E5 waves are integers >= 1, start at 1, have no gaps, and wave > every dependency's wave
//  E6 tasks in the same wave must not touch the same path (parallel write conflict)
//  E7 tasks touching sensitive paths need a later security-engineer task that depends on them
//  E8 release plans end with an orchestrator task that depends (transitively) on every task and on a qa-engineer task
//  E9 every brief has goal, read, owns, acceptance, return
//  W1 a task is in a later wave than its dependencies require (lost parallelism)
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const planPath = args.find((a) => !a.startsWith("--"));
const ai = args.indexOf("--agents");
const here = dirname(fileURLToPath(import.meta.url));
const agentsDir = ai >= 0 ? resolve(args[ai + 1]) : resolve(here, "../../../.claude/agents");
if (!planPath) { console.error("usage: node check-plan.mjs <plan.json> [--agents <dir>]"); process.exit(2); }

const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);

// Agent names come from each file's frontmatter `name:` (the filename need not match).
const agents = new Set();
for (const f of readdirSync(agentsDir).filter((f) => f.endsWith(".md"))) {
  const fm = readFileSync(join(agentsDir, f), "utf8").match(/^---\n([\s\S]*?)\n---/);
  const name = fm && fm[1].match(/^name:\s*(\S+)\s*$/m);
  if (name) agents.add(name[1]);
}
if (agents.size === 0) { console.error(`no agents found in ${agentsDir}`); process.exit(2); }

const plan = JSON.parse(readFileSync(planPath, "utf8"));
const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
if (tasks.length === 0) err("E1 plan has no tasks");
const byId = new Map();
for (const t of tasks) {
  if (typeof t.id !== "string" || !t.id) { err("E1 task without id"); continue; }
  if (byId.has(t.id)) err(`E1 duplicate id ${t.id}`);
  byId.set(t.id, t);
}

for (const t of tasks) {
  if (typeof t.owner !== "string" || t.owner.trim() === "" || t.owner.includes(",")) err(`E2 ${t.id}: owner must be exactly one agent name, got ${JSON.stringify(t.owner)}`);
  else if (!agents.has(t.owner)) err(`E2 ${t.id}: owner "${t.owner}" is not an agent in ${agentsDir}`);
  for (const d of t.dependsOn ?? []) {
    if (d === t.id) err(`E3 ${t.id} depends on itself`);
    else if (!byId.has(d)) err(`E3 ${t.id} depends on unknown task ${d}`);
  }
  const b = t.brief ?? {};
  for (const k of ["goal", "read", "owns", "acceptance", "return"]) if (!(k in b)) err(`E9 ${t.id}: brief missing "${k}"`);
}

// E4: Kahn's algorithm; also gives the earliest possible wave for W1.
const indeg = new Map(tasks.map((t) => [t.id, 0]));
const children = new Map(tasks.map((t) => [t.id, []]));
for (const t of tasks) for (const d of t.dependsOn ?? []) if (byId.has(d) && d !== t.id) { indeg.set(t.id, indeg.get(t.id) + 1); children.get(d).push(t.id); }
const earliest = new Map();
const queue = tasks.filter((t) => indeg.get(t.id) === 0).map((t) => t.id);
queue.forEach((id) => earliest.set(id, 1));
let seen = 0;
while (queue.length) {
  const id = queue.shift(); seen++;
  for (const c of children.get(id)) {
    earliest.set(c, Math.max(earliest.get(c) ?? 1, earliest.get(id) + 1));
    indeg.set(c, indeg.get(c) - 1);
    if (indeg.get(c) === 0) queue.push(c);
  }
}
const hasCycle = seen !== tasks.length;
if (hasCycle) err(`E4 dependency cycle among: ${[...indeg].filter(([, n]) => n > 0).map(([id]) => id).join(", ")}`);

// E5 / W1
const waves = new Set();
for (const t of tasks) {
  if (!Number.isInteger(t.wave) || t.wave < 1) { err(`E5 ${t.id}: wave must be an integer >= 1`); continue; }
  waves.add(t.wave);
  for (const d of t.dependsOn ?? []) {
    const dt = byId.get(d);
    if (dt && Number.isInteger(dt.wave) && dt.wave >= t.wave) err(`E5 ${t.id} (wave ${t.wave}) depends on ${d} (wave ${dt.wave}); it must run in a later wave`);
  }
  if (!hasCycle && earliest.get(t.id) < t.wave) warn(`W1 ${t.id} could start in wave ${earliest.get(t.id)} (planned ${t.wave})`);
}
const sorted = [...waves].sort((a, b) => a - b);
sorted.forEach((w, i) => { if (w !== i + 1) err(`E5 waves must be 1..N without gaps; found ${sorted.join(",")}`); });

// E6: same-wave write conflicts (a path equal to, or inside, another task's path).
const overlaps = (a, b) => a === b || a.startsWith(b.endsWith("/") ? b : b + "/") || b.startsWith(a.endsWith("/") ? a : a + "/");
for (const w of sorted) {
  const inWave = tasks.filter((t) => t.wave === w);
  for (let i = 0; i < inWave.length; i++) for (let j = i + 1; j < inWave.length; j++)
    for (const p of inWave[i].touches ?? []) for (const q of inWave[j].touches ?? [])
      if (overlaps(p, q)) err(`E6 wave ${w}: ${inWave[i].id} and ${inWave[j].id} both touch ${p === q ? p : `${p} / ${q}`}`);
}

// Transitive dependants, for E7 and E8.
const dependants = (id) => { const out = new Set(), st = [id]; while (st.length) for (const c of children.get(st.pop()) ?? []) if (!out.has(c)) { out.add(c); st.push(c); } return out; };

// E7: sensitive paths per CLAUDE.md working rules.
const SENSITIVE = [/^netlify\//, /^netlify\.toml$/, /^\.claude\//, /^\.github\//, /^scripts\//, /^package(-lock)?\.json$/, /(^|\/)allowlist/, /(^|\/)auth/, /(^|\/)\.env/];
if (!hasCycle) for (const t of tasks) {
  const hit = (t.touches ?? []).filter((p) => SENSITIVE.some((r) => r.test(p)));
  if (hit.length && t.owner !== "security-engineer" && ![...dependants(t.id)].some((id) => byId.get(id).owner === "security-engineer"))
    err(`E7 ${t.id} touches ${hit.join(", ")} but no later security-engineer task depends on it`);
}

// E8: release plans.
if (plan.release && !hasCycle) {
  const last = sorted[sorted.length - 1];
  const signoff = tasks.find((t) => t.wave === last && t.owner === "orchestrator");
  if (!signoff) err("E8 release plan: last wave needs an orchestrator sign-off task");
  else {
    const covered = tasks.filter((t) => t.id === signoff.id || dependants(t.id).has(signoff.id)).length;
    if (covered !== tasks.length) err("E8 sign-off task does not (transitively) depend on every task");
    const qa = tasks.filter((t) => t.owner === "qa-engineer");
    if (!qa.some((t) => dependants(t.id).has(signoff.id))) err("E8 sign-off task must depend on a qa-engineer task");
  }
}

// Report
for (const w of sorted) console.log(`wave ${w}: ${tasks.filter((t) => t.wave === w).map((t) => `${t.id}(${t.owner})`).join("  ")}`);
warnings.forEach((m) => console.log("WARN  " + m));
errors.forEach((m) => console.log("ERROR " + m));
console.log(errors.length ? `INVALID: ${errors.length} error(s), ${warnings.length} warning(s)` : `VALID: ${tasks.length} tasks, ${sorted.length} waves, ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
