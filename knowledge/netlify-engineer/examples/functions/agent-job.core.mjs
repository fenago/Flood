// Logic for POST /api/agent-job: create a queued job, then kick the
// background function. Dependencies are injected so it can run in tests.
import { randomBytes, createHmac } from "node:crypto";
import { json, JOB_ID } from "./lib/http.mjs";

export const signJob = (secret, id) => createHmac("sha256", secret).update(`job:${id}`).digest("base64url");

export function makeStartHandler({ requireSession, jobs, invokeBackground, secret, now = () => Date.now() }) {
  return async (req, context) => {
    const session = await requireSession(req);            // security-engineer owns this
    if (!session) return json(401, { error: "Not signed in" });

    let body;
    try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
    const { agent, task } = body ?? {};
    if (typeof agent !== "string" || !/^[a-z0-9-]{1,64}$/.test(agent)) return json(400, { error: "Bad agent" });
    if (typeof task !== "string" || task.length === 0 || task.length > 8000) return json(400, { error: "Bad task" });

    const id = `job_${randomBytes(16).toString("base64url")}`;
    const job = { id, agent, task, status: "queued", step: 0, totalSteps: 3, output: [],
                  createdAt: new Date(now()).toISOString(), updatedAt: new Date(now()).toISOString() };
    // onlyIfNew: a colliding ID (or a replay) can never overwrite an existing job.
    const w = await jobs.setJSON(id, job, { onlyIfNew: true });
    if (!w.modified) return json(409, { error: "Job exists" });

    // Background functions answer 202 at once; the body here must stay well under
    // the 256 KB background payload limit, so send only the ID (state is in Blobs).
    const res = await invokeBackground({ id, signature: signJob(secret, id) }, req, context);
    if (res.status !== 202) {
      await jobs.setJSON(id, { ...job, status: "failed", error: "could not start" });
      return json(502, { error: "Could not start job" });
    }
    return json(202, { id, status: "queued", poll: `/api/job-status?id=${id}` });
  };
}

/** Production invoker: POST to the background function on the same deploy. */
export async function fetchInvoker({ id, signature }, req) {
  return fetch(new URL("/.netlify/functions/agent-job-background", req.url), {
    method: "POST",
    headers: { "content-type": "application/json", "x-job-signature": signature },
    body: JSON.stringify({ id }),
  });
}

export { JOB_ID };
