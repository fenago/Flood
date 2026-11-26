// Netlify Blobs access. Site-wide stores (persist across deploys) with strong consistency.
// Provisional decision: every key is prefixed with the deploy context (production / deploy-preview /
// branch-deploy / dev) so a Deploy Preview never reads or writes production sessions or proposals.
import { deps } from "./deps.mjs";
import { env } from "./http.mjs";

export function deployContext(context) {
  const c = context?.deploy?.context ?? env("CONTEXT") ?? "dev";
  return /^[a-z0-9-]{1,40}$/.test(c) ? c : "dev";
}

export function openStore(name, context) {
  const raw = deps.getStore(name);
  const prefix = `${deployContext(context)}/`;
  const k = (key) => prefix + key;
  return {
    get: (key) => raw.get(k(key), { type: "json" }),
    getWithMetadata: (key) => raw.getWithMetadata(k(key), { type: "json" }),
    setJSON: (key, value, opts) => raw.setJSON(k(key), value, opts),
    delete: (key) => raw.delete(k(key)),
    list: async (p = "") => {
      const r = await raw.list({ prefix: k(p) });
      return r.blobs.map((b) => b.key.slice(prefix.length));
    },
  };
}

export class StorageError extends Error {}

/**
 * Conditional update: read with etag, apply fn(current) -> next (or undefined to stop), write with onlyIfMatch.
 * Refuses to write without an ETag: onlyIfMatch: undefined would write UNCONDITIONALLY.
 * Returns { ok, value, current } ; ok=false when another writer won (caller returns 409).
 */
export async function casUpdate(store, key, fn) {
  const cur = await store.getWithMetadata(key);
  if (!cur) return { ok: false, current: null };
  if (!cur.etag) throw new StorageError("missing etag");
  const next = await fn(cur.data);
  if (next === undefined) return { ok: false, current: cur.data };
  const res = await store.setJSON(key, next, { onlyIfMatch: cur.etag });
  return { ok: Boolean(res?.modified), value: next, current: cur.data };
}

/** Counter increment with retries. Returns the new count, or throws StorageError. */
export async function incrementCounter(store, key, by = 1, field = "n") {
  for (let i = 0; i < 4; i++) {
    const cur = await store.getWithMetadata(key);
    if (!cur) {
      const r = await store.setJSON(key, { [field]: by, at: deps.now().toISOString() }, { onlyIfNew: true });
      if (r?.modified) return by;
      continue;
    }
    if (!cur.etag) throw new StorageError("missing etag");
    const n = (cur.data?.[field] ?? 0) + by;
    const r = await store.setJSON(key, { ...cur.data, [field]: n }, { onlyIfMatch: cur.etag });
    if (r?.modified) return n;
  }
  throw new StorageError("counter contention");
}
