// netlify/functions/agent-job.mjs (example) - thin wrapper: config + wiring.
import { getStore } from "@netlify/blobs";
import { makeStartHandler, fetchInvoker } from "./agent-job.core.mjs";
import { env } from "./lib/http.mjs";
import { requireSession } from "./lib/auth.mjs"; // provided by security-engineer (not in this example)

export default async (req, context) => {
  const handler = makeStartHandler({
    requireSession,
    jobs: getStore({ name: "jobs", consistency: "strong" }),   // site-wide store, survives deploys
    invokeBackground: fetchInvoker,
    secret: env("SESSION_SECRET"),                              // read inside the handler, never logged
  });
  return handler(req, context);
};

export const config = {
  path: "/api/agent-job",
  method: "POST",
  // windowSize max 180 s. Free/Personal plans allow only 2 code-based rules per
  // project (Pro 5) - spend them on auth-login and agent-job/agent-chat first.
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
