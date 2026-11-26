// Minimal in-memory stand-in for a @netlify/blobs Store, for unit tests.
// Implements only what the examples use, with the documented semantics:
//   get / getWithMetadata (returns etag) / setJSON with onlyIfNew | onlyIfMatch
//   -> { modified, etag } / list({ prefix }) / delete.
// Every call awaits a macrotask so concurrent callers really interleave.
import { createHash } from "node:crypto";

const tick = () => new Promise((r) => setImmediate(r));

export function memoryStore() {
  const map = new Map(); // key -> { body: string, etag: string, metadata }
  let version = 0;
  const etagOf = (body) => `"${createHash("sha256").update(`${++version}:${body}`).digest("hex").slice(0, 32)}"`;

  return {
    async get(key, { type } = {}) {
      await tick();
      const e = map.get(key);
      if (!e) return null;
      return type === "json" ? JSON.parse(e.body) : e.body;
    },
    async getWithMetadata(key, { type } = {}) {
      await tick();
      const e = map.get(key);
      if (!e) return null;
      return { data: type === "json" ? JSON.parse(e.body) : e.body, etag: e.etag, metadata: e.metadata ?? {} };
    },
    async setJSON(key, value, { onlyIfNew, onlyIfMatch, metadata } = {}) {
      if (onlyIfNew && onlyIfMatch) throw new Error("onlyIfNew and onlyIfMatch are mutually exclusive");
      await tick();
      const cur = map.get(key);
      if (onlyIfNew && cur) return { modified: false };
      if (onlyIfMatch !== undefined && (!cur || cur.etag !== onlyIfMatch)) return { modified: false };
      const body = JSON.stringify(value);
      const etag = etagOf(body);
      map.set(key, { body, etag, metadata });
      return { modified: true, etag };
    },
    async list({ prefix = "" } = {}) {
      await tick();
      return { blobs: [...map].filter(([k]) => k.startsWith(prefix)).map(([key, e]) => ({ key, etag: e.etag })), directories: [] };
    },
    async delete(key) { await tick(); map.delete(key); },
  };
}
