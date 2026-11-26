---
name: netlify-blobs
description: Store Flood Watch server state in Netlify Blobs safely - stores, keys, consistency and conditional writes. Use when reading or writing sessions, chats, jobs, proposals or counters.
user-invocable: false
---
# Netlify Blobs

Detail and sources: `knowledge/netlify-engineer/docs/03-netlify-blobs.md`.

- `import { getStore } from "@netlify/blobs"`; use **site-wide** stores (`getStore`), not `getDeployStore`, so data survives deploys.
- Stores: `sessions`, `chats`, `jobs`, `proposals`, `counters`, `push` (v2).
- Keys ≤ 600 bytes, metadata ≤ 2 KB, objects ≤ 5 GB. Key pattern: `<id>` or `<date>/<id>`; list with `list({ prefix })`.
- Default is eventually consistent (≤ 60 s). For anything security- or state-critical pass `{ consistency: "strong" }`. Off Netlify (custom environment, tests) strong reads throw unless the store is given `uncachedEdgeURL`; not needed inside Netlify Functions (unconfirmed for production).
- State transitions use conditional writes: read with `getWithMetadata` (etag), write with `onlyIfMatch: etag`; create with `onlyIfNew: true`. A failed condition returns `{ modified: false }` (no exception) → return 409.
- `onlyIfMatch: undefined` writes **unconditionally**: if the read returned no ETag, refuse to write (throw / 409).
- Never store secrets, raw passwords, or the GitHub token in Blobs. Store session IDs hashed.
- Expire old data: include `createdAt`, and have a scheduled cleanup delete chats/jobs older than 30 days.
- Open decision: Deploy Previews share site-wide stores with production. Owner to choose: key prefixes per deploy context (`context.deploy.context`) vs read-only console on previews.
