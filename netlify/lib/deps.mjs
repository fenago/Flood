// Injectable dependencies so tests run the real handlers with mocks (function-testing-mocks skill):
// in-memory Blobs, a scripted Claude client, a mock GitHub API. Production uses the real ones.
import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";

export const deps = {
  getStore: (name) => getStore({ name, consistency: "strong" }),
  anthropic: (apiKey) => new Anthropic({ apiKey, maxRetries: 2 }),
  fetch: (...args) => globalThis.fetch(...args),
  githubApiBase: "https://api.github.com",
  now: () => new Date(),
};
export function setDeps(overrides) { Object.assign(deps, overrides); }
