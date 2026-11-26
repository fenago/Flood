// Mocked Supabase Auth (GoTrue) for e2e. The real project is never called.
//  - mockSupabase(target, opts): routes https://<ref>.supabase.co/** and returns { log, user }.
//  - seedSession(context, opts): mocks Supabase and pre-sets the supabase-js localStorage session so the app opens signed in.
export const REF = "ygdswggaxtyzlcscgdrf";
export const SB = `https://${REF}.supabase.co`;
export const STORAGE_KEY = `sb-${REF}-auth-token`;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

export const userFor = (email, meta = {}) => ({
  id: "u1", aud: "authenticated", role: "authenticated", email, app_metadata: {}, user_metadata: meta,
  identities: [{ id: "i" }], created_at: "2026-01-01T00:00:00Z",
});
export const sessionFor = (email, meta = {}, expires = Math.floor(Date.now() / 1000) + 3600) => ({
  access_token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsImV4cCI6OTk5OTk5OTk5OX0.sig", token_type: "bearer", expires_in: 3600,
  expires_at: expires, refresh_token: "r1", user: userFor(email, meta),
});
const authError = (status, error_code, msg) => ({ status, headers: CORS, json: { code: status, error_code, msg } });

/**
 * o: { password: 'ok'|'bad'|'unconfirmed'|'down', email, meta }. `meta` is the user's user_metadata after sign-in;
 * PUT /auth/v1/user merges body.data into it (like GoTrue) and records the request in `puts`.
 */
export async function mockSupabase(target, o = {}) {
  const log = [];
  const puts = [];
  const state = { meta: { ...(o.meta ?? {}) }, email: o.email ?? "sam@example.com" };
  await target.route(`${SB}/**`, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    log.push(`${req.method()} ${url.pathname}${url.search}`);
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname.endsWith("/authorize")) return route.abort();
    if (o.password === "down") return route.abort("internetdisconnected");
    if (url.pathname.endsWith("/signup")) {
      const { email } = req.postDataJSON();
      return route.fulfill({ headers: CORS, json: userFor(email) });
    }
    if (url.pathname.endsWith("/token")) {
      if (o.password === "bad") return route.fulfill(authError(400, "invalid_credentials", "Invalid login credentials"));
      if (o.password === "unconfirmed") return route.fulfill(authError(400, "email_not_confirmed", "Email not confirmed"));
      const body = req.postDataJSON?.() ?? {};
      return route.fulfill({ headers: CORS, json: sessionFor(body.email ?? state.email, state.meta) });
    }
    if (url.pathname.endsWith("/user")) {
      if (req.method() === "PUT") {
        const body = req.postDataJSON();
        puts.push(body);
        if (o.putStatus) return route.fulfill(authError(o.putStatus, "unexpected_failure", "boom"));
        Object.assign(state.meta, body.data ?? {});
      }
      return route.fulfill({ headers: CORS, json: userFor(state.email, state.meta) });
    }
    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname.endsWith("/recover")) return route.fulfill({ headers: CORS, json: {} });
    return route.fulfill({ status: 404, headers: CORS, json: {} });
  });
  return { log, puts, state };
}

/** Open the app signed in: mock Supabase and pre-set the stored session (once per tab, so a sign-out sticks across reloads). */
export async function seedSession(context, { email = "sam@example.com", meta = { first_name: "Sam" }, ...rest } = {}) {
  const mock = await mockSupabase(context, { email, meta, ...rest });
  const session = sessionFor(email, meta, 4102444800); // year 2100: never needs a refresh, whatever the fake clock says
  await context.addInitScript(([key, value]) => {
    try {
      if (!sessionStorage.getItem("__fw_seeded")) { localStorage.setItem(key, value); sessionStorage.setItem("__fw_seeded", "1"); }
    } catch { /* storage blocked */ }
  }, [STORAGE_KEY, JSON.stringify(session)]);
  return mock;
}
