// Response helpers. netlify.toml [[headers]] do NOT apply to Function responses, so every function
// response carries its own security headers from here (decision 2026-11-26).
export const API_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};
export const SSE_HEADERS = { ...API_HEADERS, "content-type": "text/event-stream; charset=utf-8", "x-accel-buffering": "no" };

export const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...API_HEADERS, ...extra } });

const RETRYABLE = new Set(["conversation_busy", "rate_limited", "budget_exhausted", "claude_unavailable", "storage_unavailable"]);
export function errorBody(code, message, extra = {}) {
  return { error: { code, message, retryable: RETRYABLE.has(code), ...extra } };
}
export const jsonError = (status, code, message, extra = {}, headers = {}) =>
  json(status, errorBody(code, message, extra), { ...(extra.retryAfterSeconds ? { "retry-after": String(extra.retryAfterSeconds) } : {}), ...headers });

/** Read an env var inside a handler (Netlify.env in Functions, process.env in tests/local). */
export const env = (name) => globalThis.Netlify?.env?.get?.(name) ?? process.env[name];

export async function readJsonBody(req, maxBytes = 32 * 1024) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return { error: jsonError(413, "payload_too_large", "Request body too large") };
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) return { error: jsonError(413, "payload_too_large", "Request body too large") };
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return { body };
  } catch {
    return { error: jsonError(400, "bad_request", "Body must be a JSON object") };
  }
}
