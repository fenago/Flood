// Local static server for dist/ (tests and manual checks). Usage: node scripts/serve.mjs [dir] [port] [--functions]
// With --functions, /api/* is handled by the real Netlify Function handlers with MOCKED dependencies
// (in-memory Blobs, mock Claude, mock GitHub) - see scripts/dev-functions.mjs. Never real keys.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, resolve } from 'node:path';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dir = resolve(args[0] ?? 'dist');
const port = Number(args[1] ?? 4173);
const withFunctions = process.argv.includes('--functions');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json' };

let api = null;
if (withFunctions) api = await (await import('./dev-functions.mjs')).createDevApi();

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  // LOCAL ONLY (--functions): mock Supabase token for the smoke test. This server never runs on Netlify.
  if (api && url.pathname === '/__dev/token') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(api.devToken()); }
  if (api && url.pathname.startsWith('/api/')) return api.handle(req, res, port);
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(dir, p));
  if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    const headers = { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    res.writeHead(200, headers).end(await readFile(file));
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Serving ${dir} on http://localhost:${port}${withFunctions ? ' with mocked /api' : ''}`));
