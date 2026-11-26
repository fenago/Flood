---
name: function-testing-mocks
description: Test Netlify Functions with mocked Claude, GitHub and Blobs so CI never makes real commits or paid API calls. Use when writing tests for anything in netlify/functions.
user-invocable: false
---
# Function tests with mocks

- Import the handler and call it with a `Request`; mock `Netlify.env.get`, `@netlify/blobs` (in-memory store with etag support), `@anthropic-ai/sdk` (scripted streams incl. `tool_use`, `refusal`, `max_tokens`), and `fetch` to GitHub (scripted refs/trees/commits incl. 409/422).
- Assert status codes, response bodies, Blobs state transitions, and that no unexpected outbound call happened.
- Must-have cases: no session → 401; bad CSRF → 403; over budget → 429; propose with denied path → 400; approve twice → second 409; stale base → 409 + `stale`; GitHub failure → proposal back to `pending`.
- Never put real keys in tests; CI env has dummy values only.
- Local integration (optional, manual): `netlify dev` against a throwaway test repo.
