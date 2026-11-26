// Illustrative copy of the path allow-list rules from .claude/skills/path-allowlist.
// The real module is netlify/functions/lib/allowlist.mjs, owned by security-engineer.
// Run it at propose time AND again at approve time.

const ALLOW = [
  /^public\/(?:[^/]+\/)*[^/]+\.(?:html|css|js|json|svg|webmanifest)$/,
  /^src\/(?:[^/]+\/)*[^/]+\.(?:js|mjs|css|json)$/,
  /^tests\/(?:[^/]+\/)*[^/]+\.(?:js|mjs|json)$/,
  /^docs\/(?:[^/]+\/)*[^/]+\.md$/,
];
const DENY = [
  /^netlify\//, /^netlify\.toml$/, /^\.claude\//, /^\.github\//, /^scripts\//,
  /^package\.json$/, /^package-lock\.json$/, /(^|\/)\.env/, /^public\/sw\.js$/, /^CLAUDE\.md$/,
];
const MAX_FILES = 10;
const MAX_BYTES = 200 * 1024;

export function checkPath(p) {
  if (typeof p !== "string" || p.length === 0) return "empty path";
  if (p !== p.normalize("NFC")) return "not NFC-normalised";
  if (/[\u0000-\u001f\u007f]/.test(p)) return "control character";
  if (p.includes("..") || p.includes("\\") || p.includes("//") || p.startsWith("/") || p.includes("%"))
    return "traversal or encoded character";
  if (p.split("/").some((seg) => seg.startsWith("."))) return "hidden segment";
  if (DENY.some((re) => re.test(p))) return "path is on the deny-list";
  if (!ALLOW.some((re) => re.test(p))) return "path is not on the allow-list";
  return null;
}

export function validateProposal(input) {
  const errors = [];
  const files = Array.isArray(input?.files) ? input.files : [];
  if (files.length === 0) errors.push("no files");
  if (files.length > MAX_FILES) errors.push(`more than ${MAX_FILES} files`);
  let total = 0;
  for (const f of files) {
    const why = checkPath(f.path);
    if (why) errors.push(`${JSON.stringify(f.path)}: ${why}`);
    if (typeof f.content !== "string" || f.content.includes("\u0000")) errors.push(`${f.path}: bad content`);
    else total += Buffer.byteLength(f.content, "utf8");
  }
  if (total > MAX_BYTES) errors.push(`total ${total} bytes > ${MAX_BYTES}`);
  return errors;
}
