# Netlify Blobs

Source: https://docs.netlify.com/build/data-and-storage/netlify-blobs/
Retrieved: 2026-11-26
Also checked locally: `@netlify/blobs` 11.1.11 from npm with its bundled `BlobsServer` (see examples).

The only storage allowed in Flood Watch (fixed decision 1). Skill: `netlify-blobs`.

## Stores

```js
import { getStore, getDeployStore } from "@netlify/blobs";
const jobs = getStore({ name: "jobs", consistency: "strong" }); // or getStore("jobs")
```
- `getStore` = **site-wide**: data persists across new deploys and is shared by all deploy contexts
  (so Deploy Previews see production data - see "Previews" below).
- `getDeployStore` = scoped to one deploy; follows rollbacks and is deleted with the deploy. Build
  plugins and file-based uploads must use deploy stores.
- Options include `siteID`, `token`, `region` (and `deployID` for deploy stores). Inside Functions no
  credentials are passed in the docs' examples, i.e. configured automatically (wording (unconfirmed)).
- Region: `ap-southeast-1`, `ap-southeast-2`, `eu-central-1`, `us-east-1`, `us-east-2`. Site-wide stores
  default to **`us-east-2`**; deploy stores default to the functions region.
- Our stores: `sessions`, `chats`, `jobs`, `proposals`, `counters`, `push` (v2) - all site-wide.

## API

| Method | Notes |
|---|---|
| `set(key, value, { metadata, onlyIfMatch, onlyIfNew })` | value: string, ArrayBuffer, Blob |
| `setJSON(key, value, { metadata, onlyIfMatch, onlyIfNew })` | |
| `get(key, { consistency, type })` | `type`: `text` (default), `json`, `arrayBuffer`, `blob`, `stream`; `null` if missing |
| `getWithMetadata(key, { consistency, etag, type })` | `{ data, etag, metadata }` |
| `getMetadata(key, { consistency, etag })` | |
| `list({ prefix, directories, paginate })` | `{ blobs: [{ key, etag }], directories }` |
| `delete(key)` | |
| `listStores({ paginate })` | |

Writes resolve to `{ modified, etag }`: `modified` tells whether a new entry was written; `etag` is
present only when it was.

## Consistency

- Default **eventual**: new blobs are visible everywhere immediately; **updates and deletes propagate
  within 60 s**.
- **Strong**: `getStore({ name, consistency: "strong" })` or per read `get(key, { consistency: "strong" })`.
- Netlify CLI (local) always uses strong consistency.
- Use strong for sessions, jobs, proposals and counters - a revoked session or an approved proposal
  must not look valid for another 60 s.

## Conditional writes (our double-approve and retry protection)

- `onlyIfNew: true` - succeeds only if the key does **not** exist.
- `onlyIfMatch: etag` - succeeds only if the key exists **and** its ETag matches.
- Failure is **not** an exception: you get `{ modified: false }`. Always check it; map to HTTP 409.
- Pattern: `getWithMetadata` -> decide -> `setJSON(..., { onlyIfMatch: etag })`.

### Gotchas found by running the real library (2026-11-26)

1. In a custom environment, `consistency: "strong"` throws `BlobsConsistencyError` unless the store
   is given `uncachedEdgeURL` (as well as `edgeURL`). Not an issue inside Netlify Functions.
2. The local `BlobsServer` returns **no ETag on reads** (`getWithMetadata(...).etag === undefined`);
   writes do return one and `If-Match` is enforced on writes.
3. `setJSON(k, v, { onlyIfMatch: undefined })` is an **unconditional** write. So always check
   `if (!etag) throw ...` before a conditional write. Whether production always returns an ETag on
   reads is (unconfirmed); the docs list it, but keep the guard.
4. Local ETags are mtime-based; two writes in the same millisecond can share an ETag (local only).

## Limits

| Item | Limit |
|---|---|
| Key | <= **600 bytes**, not empty, cannot start with `/` |
| Object | <= **5 GB** |
| Metadata | <= **2 KB** per object |
| Store name | no `/` or `:`, <= **64 bytes** |

## Local development

`netlify dev` uses a **sandboxed local store**; it cannot read production data and does not support
file-based uploads. For unit tests use a stub with the same semantics (`../examples/memory-blobs.mjs`)
or `BlobsServer` from `@netlify/blobs/server`.

## Previews and data safety

- Because site-wide stores are shared by every deploy context, a Deploy Preview's console works on
  the **same** sessions/proposals as production. Options: prefix keys with `context.deploy.context`
  for non-production, or keep previews' console read-only. (Decision for software-architect.)
- Never store secrets, raw passwords or tokens. Store session IDs hashed (`sha256`).
- Add `createdAt` to every record; scheduled cleanup removes old chats/jobs (30 days).
