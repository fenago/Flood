// fetch + JSON with a timeout. The service worker adds X-Fetched-At to responses it serves from cache,
// so a response WITH that header is cached (stale) data and one without it is live.
export class ApiError extends Error {
  constructor(source, status, reason) {
    super(`${source} ${status}: ${reason}`);
    this.source = source;
    this.status = status;
    this.retryable = status === 0 || status === 429 || status >= 500;
  }
}

export async function fetchJson(source, url, { fetchImpl = globalThis.fetch, timeoutMs = 15000, headers } = {}) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  let res;
  try {
    res = await fetchImpl(url, { headers, signal: ctl?.signal });
  } catch (e) {
    throw new ApiError(source, 0, e?.name === 'AbortError' ? 'timeout' : 'network error');
  } finally {
    if (timer) clearTimeout(timer);
  }
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON body */ }
  if (body && body.error === true) throw new ApiError(source, res.status, String(body.reason ?? 'error'));
  if (!res.ok) throw new ApiError(source, res.status, 'HTTP error');
  if (body === null) throw new ApiError(source, res.status, 'invalid JSON');
  const stamp = res.headers?.get?.('X-Fetched-At');
  const fetchedAt = stamp ? new Date(stamp) : new Date();
  return { data: body, fetchedAt, fromCache: Boolean(stamp) };
}
