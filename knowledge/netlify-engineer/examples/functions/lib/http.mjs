// Shared helpers for function examples.
// netlify.toml [[headers]] do NOT apply to function responses (Netlify custom
// headers docs), so every function sets its own security headers here.
export const API_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
};

export const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...API_HEADERS, ...extra } });

/** Read a variable inside a handler. Netlify docs confirm process.env for functions;
 *  the Netlify.env global is used by the project skills (unconfirmed on the pages read). */
export const env = (name) => globalThis.Netlify?.env?.get?.(name) ?? process.env[name];

export const JOB_ID = /^job_[A-Za-z0-9_-]{16,64}$/;
