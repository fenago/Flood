#!/usr/bin/env node
// Validate agent-chat.schema.json and every example payload against it.
// Needs ajv@8 (not a repo dependency). Install it outside the repo and point AJV_DIR at that folder:
//   (cd /some/scratch && npm init -y && npm i ajv@8)
//   AJV_DIR=/some/scratch node knowledge/software-architect/examples/validate-agent-chat.mjs
// Checks:
//  1. The schema compiles in Ajv strict mode (draft 2020-12), i.e. the schema itself is valid.
//  2. Every case in payloads/cases.json validates (or fails) as its "valid" flag says.
//  3. Every payloads/*.sse transcript parses as SSE; each event matches SseEvent; the stream starts
//     with exactly one "start", ends with exactly one terminal "done" or "error", and nothing follows it.
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
if (!process.env.AJV_DIR) { console.error("Set AJV_DIR to a folder containing node_modules/ajv"); process.exit(2); }
const require = createRequire(join(process.env.AJV_DIR, "package.json"));
const Ajv2020 = require("ajv/dist/2020").default;

const schema = JSON.parse(readFileSync(join(here, "agent-chat.schema.json"), "utf8"));
const ajv = new Ajv2020({ strict: true, allErrors: true });
ajv.addSchema(schema);
const v = (def) => ajv.getSchema(`${schema.$id}#/$defs/${def}`);
let failures = 0;
const fail = (m) => { failures++; console.log("FAIL " + m); };

// 1. compile every top-level definition (throws on an invalid schema in strict mode)
for (const def of ["ChatRequest", "SseEvent", "ErrorResponse", "ChatRecord"]) {
  try { if (!v(def)) fail(`schema: $defs/${def} not found`); }
  catch (e) { console.log(`FAIL schema: $defs/${def} does not compile: ${e.message}`); process.exit(1); }
}
console.log(`schema compiled (strict, draft 2020-12): ${schema.$id}`);

// 2. cases
const cases = JSON.parse(readFileSync(join(here, "payloads/cases.json"), "utf8"));
for (const c of cases) {
  const validate = v(c.def);
  const ok = validate(c.value);
  if (ok === c.valid) console.log(`ok   [${c.def}] ${c.name}${ok ? "" : `  (rejected: ${validate.errors[0].instancePath || "/"} ${validate.errors[0].message})`}`);
  else fail(`[${c.def}] ${c.name}: expected ${c.valid ? "valid" : "invalid"}, got ${ok ? "valid" : JSON.stringify(validate.errors)}`);
}

// 3. SSE transcripts (WHATWG event-stream: "field: value" lines, blank line ends an event, ":" starts a comment)
function parseSse(text) {
  const events = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    let event = "message", data = [];
    const lines = block.split(/\r?\n/).filter((l) => l !== "" && !l.startsWith(":"));
    if (lines.length === 0) continue;
    for (const line of lines) {
      const i = line.indexOf(":");
      const field = i < 0 ? line : line.slice(0, i);
      const value = i < 0 ? "" : line.slice(i + 1).replace(/^ /, "");
      if (field === "event") event = value; else if (field === "data") data.push(value);
      else throw new Error(`unexpected SSE field "${field}"`);
    }
    events.push({ event, data: JSON.parse(data.join("\n")) });
  }
  return events;
}
const sseEvent = v("SseEvent");
for (const f of readdirSync(join(here, "payloads")).filter((f) => f.endsWith(".sse"))) {
  let events;
  try { events = parseSse(readFileSync(join(here, "payloads", f), "utf8")); } catch (e) { fail(`${f}: ${e.message}`); continue; }
  events.forEach((e, i) => { if (!sseEvent(e)) fail(`${f} event #${i} (${e.event}): ${JSON.stringify(sseEvent.errors[0])}`); });
  const names = events.map((e) => e.event);
  const terminal = names.filter((n) => n === "done" || n === "error").length;
  if (names[0] !== "start" || names.filter((n) => n === "start").length !== 1) fail(`${f}: must begin with exactly one start event`);
  if (terminal !== 1 || !["done", "error"].includes(names.at(-1))) fail(`${f}: must end with exactly one done or error event`);
  const start = events[0].data;
  if (names.includes("proposal") && !events.some((e) => e.event === "tool" && e.data.name === "propose_change")) fail(`${f}: proposal event without a propose_change tool event`);
  console.log(`ok   ${f}: ${names.join(" > ")} (turn ${start.turn})`);
}

console.log(failures ? `FAILED: ${failures} problem(s)` : `ALL PASSED: ${cases.length} cases + SSE transcripts`);
process.exit(failures ? 1 : 0);
