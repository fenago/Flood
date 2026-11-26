Source: https://docs.netlify.com/build/data-and-storage/netlify-blobs/
Retrieved: 2026-11-26

# Netlify Blobs: the only storage

Fixed decision 1: Netlify Blobs is the only server-side storage. These are the properties the design depends on.

## 1. Store types

| API | Scope | Use for us |
|---|---|---|
| `getStore(name)` | Site-wide. "Data added to that store will be persisted on new deploys, available on all deploy contexts" | Sessions, chats, jobs, proposals, counters |
| `getDeployStore(name)` | "scoped to a specific deploy" | Not used (data would vanish on each approved commit) |

Both are reachable from Functions, Edge Functions and Build Plugins. Note "available on all deploy contexts": a Deploy Preview's functions see the **same** site-wide stores as production. Prefix keys or use separate store names per context if previews must not touch production data (design choice).

## 2. Naming and size limits

| Item | Limit |
|---|---|
| Store name | no `/`, no `:`, <= 64 bytes |
| Key | not empty, any Unicode, must not start with `/`, <= 600 bytes |
| Metadata per object | <= 2 KB |
| Object size | <= 5 GB |

## 3. Consistency

- Default is eventual: "data is stored in a single region and cached at the edge". New blobs are globally available immediately; "Updates and deletions are guaranteed to be propagated to all edge locations within 60 seconds."
- Strong consistency can be chosen "either for an entire store or for individual read operations". Netlify CLI always uses strong consistency (so local dev hides eventual-consistency bugs).
- Rule: open state stores with strong consistency (sessions, jobs, proposals, chats, counters). A session revoked on logout must not stay valid for up to 60 s.

## 4. Conditional writes

| Option | Write succeeds only if |
|---|---|
| `onlyIfNew: true` | the entry does not exist |
| `onlyIfMatch: <etag>` | the entry exists and its ETag matches |

- Writes resolve to `{ modified: boolean, etag?: string }`; `etag` only when a new entry was produced.
- Patterns:
  - Create proposal / job once: `setJSON(id, value, { onlyIfNew: true })`; `modified: false` -> already exists (idempotent retry).
  - State transition (pending -> approving): read with `getWithMetadata` to get the etag, then `setJSON(..., { onlyIfMatch: etag })`; `modified: false` -> someone else changed it -> HTTP 409.
  - Counters: read-modify-write with `onlyIfMatch`, retry a few times on `modified: false`.

## 5. Reading and listing

- `setJSON(key, value, { metadata, onlyIfMatch, onlyIfNew })`; `get(key, { type: "json" })`.
- `getWithMetadata(key, { consistency, etag, type })` - "useful to check if a blob exists without actually retrieving it".
- `list({ prefix, directories, paginate })`; `directories: true` treats `/` in keys as folders; pagination is automatic unless `paginate` is set.

## 6. Regions

- Blobs regions: `ap-southeast-1`, `ap-southeast-2`, `eu-central-1`, `us-east-1`, `us-east-2`. Other values throw `InvalidBlobsRegionError`.
- "Site-wide stores default to `us-east-2`, regardless of your functions region."
- Functions default to `cmh` (Ohio, doc 02), which is the same area as `us-east-2` (Ohio). Keep defaults.

## 7. Store and key plan for Flood Watch

| Store | Key | Value | Write rule |
|---|---|---|---|
| `sessions` | `<sha256(sessionId)>` | `{createdAt, expiresAt, ipHash}` | `onlyIfNew`; delete on logout |
| `chats` | `<conversationId>` | conversation record (see agent-chat spec) | `onlyIfMatch` per turn |
| `jobs` | `<jobId>` and `<jobId>/events/<seq>` | job state / progress events | `onlyIfNew` create, `onlyIfMatch` update |
| `proposals` | `<proposalId>` | `{status, agent, baseSha, files, summary, createdAt}` | `onlyIfNew`, then `onlyIfMatch` transitions |
| `counters` | `tokens/<YYYY-MM-DD>`, `login-fail/<ipHash>` | numbers | `onlyIfMatch` retry loop |

Never store secrets, raw passwords, raw session IDs or the GitHub token. Include `createdAt` everywhere so a cleanup job can expire old data.

## 8. Not stated on the page

- Request-rate or cost limits for Blobs operations (unconfirmed; check pricing/usage docs before high-volume use).
- Whether a single `setJSON` is atomic for readers mid-write (assumed yes; unconfirmed).
