// Static build: copies public/ and src/ into dist/ (src served at /src), then stamps dist/sw.js with a
// content-hash VERSION and the list of shell files. No secrets are read or written here.
import { cp, rm, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist');

async function walk(dir) {
  const files = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) files.push(...await walk(p)); else files.push(p);
  }
  return files;
}

await rm(out, { recursive: true, force: true });
await cp(join(root, 'public'), out, { recursive: true });
await cp(join(root, 'src'), join(out, 'src'), { recursive: true });

// Shell = everything needed to start offline. The console is excluded (never cached).
const all = (await walk(out)).map((p) => '/' + relative(out, p).split(sep).join('/'));
const shell = all.filter((p) => p !== '/sw.js' && !p.startsWith('/console/') && /\.(html|css|js|json|webmanifest|png|svg)$/.test(p)).sort();
const hash = createHash('sha256');
for (const p of shell) hash.update(p).update(await readFile(join(out, p)));
const version = hash.digest('hex').slice(0, 12);
const shellList = ['/', ...shell].map((p) => JSON.stringify(p)).join(', ');
const swPath = join(out, 'sw.js');
const sw = (await readFile(swPath, 'utf8')).replace("'__FW_VERSION__'", JSON.stringify(version)).replace('/*__FW_SHELL__*/', shellList);
if (sw.includes('__FW_')) throw new Error('sw.js placeholders not replaced');
await writeFile(swPath, sw);
console.log(`dist/ built: ${all.length} files, ${shell.length + 1} shell entries, sw version ${version}`);
