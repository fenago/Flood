// Tiny static server for the example app (local testing only; production is Netlify).
// Run directly:  node serve.mjs [port]   -> http://localhost:4173
// Or import { startServer } from a test script.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'app');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', // MDN: the spec's media type
};

export function startServer({ port = 4173 } = {}) {
  let swVersion = null; // when set, rewrites VERSION in sw.js to simulate a deploy
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path === '/') path = '/index.html';
      const file = normalize(join(ROOT, path));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      let body = await readFile(file);
      if (path === '/sw.js' && swVersion) {
        body = Buffer.from(body.toString().replace(/const VERSION = '[^']*'/, `const VERSION = '${swVersion}'`));
      }
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
        // sw.js must never be served stale, or users miss updates.
        'Cache-Control': path === '/sw.js' ? 'no-cache' : 'max-age=0',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({
    url: `http://localhost:${port}`,
    setSwVersion: (v) => { swVersion = v; },
    close: () => new Promise((r) => server.close(r)),
  })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await startServer({ port: Number(process.argv[2]) || 4173 });
  console.log(`Serving ${ROOT} at ${url}`);
}
