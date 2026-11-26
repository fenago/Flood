// In-memory mock of Supabase Auth GET /auth/v1/user, exposed as a fetch() implementation (no network,
// never the real project). Tokens are JWT-shaped strings with an unsigned payload; only this mock
// decides whether a token is valid, exactly like the real endpoint would.
import { randomBytes, randomUUID } from "node:crypto";

export const SUPABASE_URL = "https://mock-project.supabase.test";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_dummy_value";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

export function mockSupabase({ now }) {
  const users = new Map(); // token -> user
  const calls = [];
  let mode = "up"; // up | down (network error) | 500 | 429 | hang | badjson
  const sec = (d) => Math.floor(d.getTime() / 1000);

  /** Create a user + access token. Defaults: confirmed, signed in "now", password amr "now". */
  function issue({ email = "owner@example.com", confirmed = true, confirmedField = "email_confirmed_at", lastSignInAt, amrAt, amr, bannedUntil, sub = randomUUID(), role = "authenticated", expInS = 3600 } = {}) {
    const t = now();
    const signIn = lastSignInAt ?? t;
    const claims = { sub, role, aud: "authenticated", email, iat: sec(t), exp: sec(t) + expInS, session_id: randomUUID(),
      amr: amr ?? [{ method: "password", timestamp: sec(amrAt ?? signIn) }] };
    const token = `${b64({ alg: "ES256", typ: "JWT" })}.${b64(claims)}.${randomBytes(32).toString("base64url")}`;
    const user = { id: sub, aud: "authenticated", role, email, last_sign_in_at: signIn.toISOString(), created_at: t.toISOString(),
      ...(confirmed ? { [confirmedField]: t.toISOString() } : {}), ...(bannedUntil ? { banned_until: bannedUntil.toISOString() } : {}) };
    users.set(token, user);
    return token;
  }

  async function fetchImpl(url, init = {}) {
    const u = new URL(url);
    const h = new Headers(init.headers ?? {});
    calls.push({ path: u.pathname, apikey: h.get("apikey"), hasSignal: Boolean(init.signal) });
    if (mode === "down") throw new TypeError("fetch failed");
    if (mode === "hang") {
      return new Promise((_, reject) => {
        if (init.signal?.aborted) return reject(init.signal.reason);
        init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true });
      });
    }
    const reply = (status, body) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (mode === "500") return reply(500, { message: "internal" });
    if (mode === "429") return reply(429, { message: "rate limited" });
    if (u.pathname !== "/auth/v1/user" || (init.method ?? "GET") !== "GET") return reply(404, { message: "not found" });
    if (h.get("apikey") !== SUPABASE_PUBLISHABLE_KEY) return reply(401, { message: "Invalid API key" });
    const m = /^Bearer (.+)$/.exec(h.get("authorization") ?? "");
    const user = m && users.get(m[1]);
    if (!user) return reply(403, { code: "bad_jwt", message: "invalid JWT" });
    if (mode === "badjson") return reply(200, "{not json");
    return reply(200, user);
  }

  return { fetch: fetchImpl, issue, calls, users, setMode: (m) => { mode = m; }, revoke: (token) => users.delete(token) };
}
