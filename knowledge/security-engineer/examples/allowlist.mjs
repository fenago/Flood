// Worked example: path allow-list validator for Agent Console proposals.
// Rules from .claude/skills/path-allowlist/SKILL.md; run at propose AND approve.
// Strategy (OWASP Path Traversal): accept only known-good shapes; never decode,
// never "clean up" input; reject anything odd outright.

const SEG = "[a-z0-9_-]+(?:\\.[a-z0-9_-]+)*"; // lowercase ASCII; dots only *inside* a name
const DIRS = `(?:${SEG}/)*`;

export const WRITE_ALLOW = [
  new RegExp(`^public/${DIRS}${SEG}\\.(?:html|css|js|json|svg|webmanifest)$`),
  new RegExp(`^src/${DIRS}${SEG}\\.(?:js|mjs|css|json)$`),
  new RegExp(`^tests/${DIRS}${SEG}\\.(?:js|mjs|json)$`),
  new RegExp(`^docs/${DIRS}${SEG}\\.md$`),
];

// Deny always wins. Case-sensitive on purpose; uppercase never matches ALLOW anyway.
export const WRITE_DENY = [
  /^netlify(?:\/|\.toml$)/, /^\.claude\//, /^\.github\//, /^scripts\//,
  /^package(?:-lock)?\.json$/, /(?:^|\/)\.env/, /^public\/sw\.js$/, /^CLAUDE\.md$/,
];

export const LIMITS = { maxFiles: 10, maxTotalBytes: 200 * 1024 };

/** Returns null if the path is acceptable, else a short reason string. */
export function pathProblem(p) {
  if (typeof p !== "string" || p.length === 0) return "empty";
  if (p.length > 200) return "too long";
  if (p !== p.normalize("NFC")) return "not NFC";
  if (/[\u0000-\u001f\u007f]/.test(p)) return "control char";
  if (p.includes("..")) return "dot-dot";
  if (p.includes("\\")) return "backslash";
  if (p.includes("//")) return "empty segment";
  if (p.startsWith("/")) return "absolute";
  if (p.includes("%")) return "percent-encoding";
  if (p.startsWith(".") || p.includes("/.")) return "hidden segment";
  if (WRITE_DENY.some((r) => r.test(p))) return "denied path";
  if (!WRITE_ALLOW.some((r) => r.test(p))) return "not on allow-list";
  return null;
}

/** Validate a whole proposal: { files: [{ path, content }] }. Returns list of problems. */
export function validateProposal(proposal) {
  const problems = [];
  const files = proposal?.files;
  if (!Array.isArray(files) || files.length === 0) return ["no files"];
  if (files.length > LIMITS.maxFiles) problems.push(`more than ${LIMITS.maxFiles} files`);
  const seen = new Set();
  let total = 0;
  for (const f of files) {
    const why = pathProblem(f?.path);
    if (why) problems.push(`${JSON.stringify(f?.path)}: ${why}`);
    const folded = String(f?.path).toLowerCase(); // catch case-only duplicates (macOS/Windows clones)
    if (seen.has(folded)) problems.push(`${JSON.stringify(f?.path)}: duplicate`);
    seen.add(folded);
    if (typeof f?.content !== "string") { problems.push(`${JSON.stringify(f?.path)}: content not text`); continue; }
    if (!f.content.isWellFormed()) problems.push(`${JSON.stringify(f.path)}: invalid UTF-16/UTF-8 (lone surrogate)`);
    if (f.content.includes("\u0000")) problems.push(`${JSON.stringify(f.path)}: NUL byte`);
    total += Buffer.byteLength(f.content, "utf8");
  }
  if (total > LIMITS.maxTotalBytes) problems.push(`total ${total} bytes > ${LIMITS.maxTotalBytes}`);
  return problems;
}
