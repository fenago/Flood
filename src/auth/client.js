// Account sign-in via Supabase Auth (accounts only; no app data is stored in Supabase).
// The publishable key in /config/auth.json is public by design. The library is loaded lazily from
// /vendor/supabase.mjs (bundled at build time; CSP allows script-src 'self' only) so that a missing
// library or config can never break the public weather app: every helper then returns code "unavailable".
//
// Every helper resolves to { ok: true, ... } or { ok: false, code } and never throws.
// Codes: unavailable | invalid_credentials | email_not_confirmed | network | weak_password |
//        rate_limited | user_exists | unknown.

const deps = {
  loadConfig: async () => {
    const r = await fetch('/config/auth.json');
    if (!r.ok) throw new Error('auth config missing');
    return r.json();
  },
  loadLib: () => import('/vendor/supabase.mjs'),
};

/** Test hook: replace the config and library loaders. Pass null to reset the cached client. */
export function __configure(over) {
  Object.assign(deps, over ?? {});
  clientPromise = null;
}

let clientPromise = null;

/** Resolves to the Supabase client, or null when config or library cannot be loaded. Retries after a failure. */
export function init() {
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const [cfg, lib] = await Promise.all([deps.loadConfig(), deps.loadLib()]);
        if (!cfg || !/^https:\/\//.test(cfg.supabaseUrl ?? '') || !cfg.publishableKey || typeof lib?.createClient !== 'function') return null;
        return lib.createClient(cfg.supabaseUrl, cfg.publishableKey, {
          auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
        });
      } catch {
        return null;
      }
    })().then((c) => { if (!c) clientPromise = null; return c; });
  }
  return clientPromise;
}

export const isAvailable = async () => (await init()) !== null;

export function mapError(err) {
  if (!err) return 'unknown';
  const code = err.code ?? '';
  const msg = String(err.message ?? '');
  if (err instanceof TypeError || err.name === 'AuthRetryableFetchError' || err.status === 0 || /failed to fetch|networkerror|load failed/i.test(msg)) return 'network';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'invalid_credentials';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'email_not_confirmed';
  if (code === 'weak_password' || err.name === 'AuthWeakPasswordError') return 'weak_password';
  if (code === 'user_already_exists' || code === 'email_exists') return 'user_exists';
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || err.status === 429) return 'rate_limited';
  return 'unknown';
}

async function call(fn) {
  const client = await init();
  if (!client) return { ok: false, code: 'unavailable' };
  try {
    const { data, error } = await fn(client);
    if (error) return { ok: false, code: mapError(error) };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, code: mapError(err) };
  }
}

const origin = () => location.origin + '/';
const clean = (email) => String(email ?? '').trim();

/** ok:true with needsConfirmation:true when the user must click the emailed link. */
export async function signUp(email, password) {
  const r = await call((c) => c.auth.signUp({ email: clean(email), password, options: { emailRedirectTo: origin() } }));
  if (!r.ok) return r;
  // With email confirmation on, no session is returned. An already-registered address looks the same
  // on purpose (Supabase avoids revealing which emails have accounts), so we say the same thing.
  return { ok: true, needsConfirmation: !r.data?.session };
}

export async function signIn(email, password) {
  const r = await call((c) => c.auth.signInWithPassword({ email: clean(email), password }));
  return r.ok ? { ok: true, session: r.data?.session ?? null } : r;
}

/** Navigates the browser to Google via Supabase; resolves ok:true once the redirect has started. */
export async function signInWithGoogle() {
  const r = await call((c) => c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin() } }));
  return r.ok ? { ok: true } : r;
}

export async function signOut() {
  const r = await call((c) => c.auth.signOut());
  return r.ok ? { ok: true } : r;
}

export async function resetPassword(email) {
  const r = await call((c) => c.auth.resetPasswordForEmail(clean(email), { redirectTo: origin() }));
  return r.ok ? { ok: true } : r;
}

/** Used after the emailed recovery link brings the user back (event PASSWORD_RECOVERY). */
export async function updatePassword(password) {
  const r = await call((c) => c.auth.updateUser({ password }));
  return r.ok ? { ok: true } : r;
}

/** Current session or null (also null when unavailable). */
export async function getSession() {
  const r = await call((c) => c.auth.getSession());
  return r.ok ? (r.data?.session ?? null) : null;
}

/** JWT for `Authorization: Bearer <token>` on /api/*, or null when signed out. */
export async function getAccessToken() {
  return (await getSession())?.access_token ?? null;
}

/** cb(event, session). Returns an unsubscribe function immediately; safe to call before the library loads. */
export function onAuthChange(cb) {
  let off = null;
  let cancelled = false;
  init().then((c) => {
    if (!c || cancelled) return;
    const { data } = c.auth.onAuthStateChange((event, session) => cb(event, session));
    off = () => data?.subscription?.unsubscribe?.();
  });
  return () => { cancelled = true; off?.(); };
}
