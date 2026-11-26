// Per-IP fixed-window counters in Blobs for endpoints without a Netlify platform rule
// (Free/Personal allow only 2 rules; we spend them on session and agent-chat).
import { openStore, incrementCounter, StorageError } from "./blobs.mjs";
import { ipHash } from "./auth.mjs";
import { jsonError } from "./http.mjs";
import { deps } from "./deps.mjs";

export const LIMITS = { agents: 30, proposals: 30, "proposal-approve": 5, "proposal-reject": 5 };

/** Returns a 429/503 Response when over the limit, else null. Fails closed on storage errors. */
export async function rateLimit(endpoint, context, limit = LIMITS[endpoint], windowS = 60) {
  const win = Math.floor(deps.now().getTime() / (windowS * 1000));
  const key = `counters/${endpoint}/${ipHash(context)}/${win}`;
  try {
    const n = await incrementCounter(openStore("counters", context), key);
    if (n > limit) {
      const retry = windowS - Math.floor((deps.now().getTime() / 1000) % windowS);
      return jsonError(429, "rate_limited", "Too many requests", { retryAfterSeconds: retry });
    }
    return null;
  } catch (e) {
    if (e instanceof StorageError) return jsonError(503, "storage_unavailable", "Try again shortly", { retryAfterSeconds: 5 });
    throw e;
  }
}
