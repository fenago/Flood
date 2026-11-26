// Lints security-headers.toml (or any netlify.toml) for the project's CSP rules.
// Needs smol-toml resolvable from the CURRENT directory (kept out of the repo):
//   cd <scratch dir with smol-toml installed> && node <repo>/knowledge/security-engineer/examples/check-headers.mjs <toml path>
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const { parse } = createRequire(process.cwd() + "/")("smol-toml");
const file = process.argv[2] ?? new URL("./security-headers.toml", import.meta.url).pathname;
const cfg = parse(readFileSync(file, "utf8"));
const rules = cfg.headers ?? [];
const problems = [];

const csp = (rule) => rule.values?.["Content-Security-Policy"] ?? "";
const directives = (policy) => Object.fromEntries(
  policy.split(";").map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(/\s+/); return [k, v]; }),
);

const root = rules.find((r) => r.for === "/*");
if (!root) problems.push('no [[headers]] for "/*"');
for (const r of rules.filter((r) => csp(r))) {
  const d = directives(csp(r));
  if (/'unsafe-(inline|eval)'/.test(csp(r))) problems.push(`${r.for}: unsafe-inline/eval present`);
  if (JSON.stringify(d["frame-ancestors"]) !== JSON.stringify(["'none'"])) problems.push(`${r.for}: frame-ancestors not 'none'`);
  if (JSON.stringify(d["object-src"]) !== JSON.stringify(["'none'"])) problems.push(`${r.for}: object-src not 'none'`);
  if (!d["base-uri"]) problems.push(`${r.for}: base-uri missing`);
  if (!d["default-src"]) problems.push(`${r.for}: default-src missing`);
  for (const src of d["connect-src"] ?? []) {
    if (src !== "'self'" && !src.startsWith("https://")) problems.push(`${r.for}: non-https connect-src ${src}`);
    if (src.includes("*")) problems.push(`${r.for}: wildcard connect-src ${src}`);
  }
}
const consoleRule = rules.find((r) => r.for === "/console/*");
if (consoleRule && JSON.stringify(directives(csp(consoleRule))["connect-src"]) !== JSON.stringify(["'self'"]))
  problems.push("/console/*: connect-src should be 'self' only");
if (root?.values?.["X-Content-Type-Options"] !== "nosniff") problems.push("/*: nosniff missing");
for (const r of rules) if (r.values && "Set-Cookie" in r.values) problems.push(`${r.for}: Set-Cookie cannot be set via Netlify headers`);

console.log(`${rules.length} header rules checked in ${file}`);
if (problems.length) { console.log("PROBLEMS:\n- " + problems.join("\n- ")); process.exit(1); }
console.log("OK: no unsafe-inline/eval, frame-ancestors 'none', object-src 'none', https-only connect-src, console connect-src 'self'");
