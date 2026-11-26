// LOCAL ONLY: run the real /api handlers with mocked dependencies (in-memory Blobs, scripted Claude,
// in-memory GitHub). Used by `node scripts/serve.mjs dist 4173 --functions`, the console e2e test and
// `npm run smoke`. Never uses real keys; sign-in goes to an in-memory mock of Supabase Auth.
import { setDeps } from "../netlify/lib/deps.mjs";
import { mockSupabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../tests/helpers/mock-supabase.mjs";
import { memoryBlobs } from "../tests/helpers/memory-blobs.mjs";
import { mockClaude } from "../tests/helpers/mock-claude.mjs";
import { mockGitHub } from "../tests/helpers/mock-github.mjs";

export const DEV_ADMIN_EMAIL = "owner@example.com";
let supabase = null;
/** Local-only: issue a mock Supabase access token for the dev admin (or another email). */
export function devToken(email = DEV_ADMIN_EMAIL) { return supabase.issue({ email }); }

export async function createDevApi() {
  const gh = mockGitHub({ "docs/decisions.md": "# Decisions log\n\nOld line.\n", "public/config/scoring.json": "{\n  \"version\": 1\n}\n" });
  const claude = mockClaude([
    { chunks: ["I'll read the decisions log ", "first."], toolUses: [{ name: "read_file", input: { path: "docs/decisions.md" } }] },
    { chunks: ["Here is a proposal for you to review."], toolUses: [{ name: "propose_change", input: { summary: "Add a line to the decisions log", files: [{ path: "docs/decisions.md", content: "# Decisions log\n\nOld line.\nNew line from the agent.\n" }] } }] },
    { text: "Done. The proposal is waiting for your review; nothing is committed until you approve it." },
  ]);
  supabase = mockSupabase({ now: () => new Date() });
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
  process.env.CONSOLE_ADMIN_EMAILS = DEV_ADMIN_EMAIL;
  process.env.ANTHROPIC_API_KEY = "local-dummy-not-a-key";
  process.env.GITHUB_TOKEN = "local-dummy-not-a-token";
  process.env.GITHUB_REPO = `${gh.owner}/${gh.repo}`;
  process.env.GITHUB_BRANCH = "main";
  process.env.CONTEXT = "dev";
  if (process.env.FW_SMOKE_UNCONFIGURED) { // simulate a fresh Netlify deploy with no console variables
    for (const k of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "CONSOLE_ADMIN_EMAILS", "ANTHROPIC_API_KEY", "GITHUB_TOKEN"]) delete process.env[k];
  }
  const fetch = (url, init) => (new URL(url).origin === SUPABASE_URL ? supabase.fetch(url, init) : gh.fetch(url, init));
  setDeps({ getStore: memoryBlobs().getStore, anthropic: () => claude.client, fetch, githubApiBase: "https://api.github.test" });

  const routes = {};
  for (const name of ["session", "agents", "agent-chat", "proposals", "proposal-approve", "proposal-reject"]) {
    const mod = await import(`../netlify/functions/${name}.mjs`);
    routes[mod.config.path] = mod;
  }
  return {
    gh, claude, devToken,
    async handle(req, res, port) {
      const url = new URL(req.url, `http://localhost:${port}`);
      const mod = routes[url.pathname];
      if (!mod) { res.writeHead(404, { "content-type": "application/json" }).end('{"error":{"code":"not_found"}}'); return; }
      if (mod.config.method && req.method !== mod.config.method) { res.writeHead(405).end(); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
      const request = new Request(url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
      const response = await mod.default(request, { ip: req.socket.remoteAddress, requestId: "dev", deploy: { context: "dev" } });
      const out = {}; response.headers.forEach((v, k) => { out[k] = v; });
      res.writeHead(response.status, out);
      if (response.body) for await (const chunk of response.body) res.write(chunk);
      res.end();
    },
  };
}
