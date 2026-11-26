// CI grep: fail if built output contains anything shaped like a secret (release-signoff checklist).
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
const dir = process.argv[2] ?? 'dist';
const PATTERNS = [/sk-ant-[A-Za-z0-9_-]{8,}/, /github_pat_[A-Za-z0-9_]{8,}/, /ghp_[A-Za-z0-9]{20,}/, /gho_[A-Za-z0-9]{20,}/, /scrypt\$\d+\$\d+\$\d+\$/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
async function walk(d) { const o = []; for (const n of await readdir(d)) { const p = join(d, n); (await stat(p)).isDirectory() ? o.push(...await walk(p)) : o.push(p); } return o; }
const hits = [];
for (const f of await walk(dir)) {
  const text = (await readFile(f)).toString('latin1');
  for (const re of PATTERNS) if (re.test(text)) hits.push(`${f}: ${re}`);
}
if (hits.length) { console.error('Secret-like strings in build output:\n' + hits.join('\n')); process.exit(1); }
console.log(`check-secrets: ${dir} clean (${PATTERNS.length} patterns)`);
