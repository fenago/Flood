// netlify/functions/agent-job-background.mjs (example) - wrapper.
// background: true -> caller gets an empty 202 immediately, runs up to 15 min,
// return value discarded, retried after 1 min and 2 min on error.
// Default URL: /.netlify/functions/agent-job-background
import { getStore } from "@netlify/blobs";
import { makeBackgroundHandler } from "./agent-job-background.core.mjs";
import { env } from "./lib/http.mjs";
import { runAgentTurn } from "./lib/agent-turn.mjs"; // one Claude turn; agent-console-engineer owns it

export default async (req) => {
  const handler = makeBackgroundHandler({
    jobs: getStore({ name: "jobs", consistency: "strong" }),
    proposals: getStore({ name: "proposals", consistency: "strong" }),
    runStep: runAgentTurn,
    secret: env("SESSION_SECRET"),
  });
  await handler(req);
};

export const config = { background: true };
