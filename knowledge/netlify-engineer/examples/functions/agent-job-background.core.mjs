// Logic for the background job. Netlify retries a failed background
// invocation after 1 minute and again 2 minutes later, so EVERY run must be
// safe to repeat:
//  - exit at once if the job is already done/failed;
//  - resume from the saved step (state saved after every step);
//  - advance state only with onlyIfMatch(etag) so two runs cannot both win;
//  - create the proposal with onlyIfNew under an ID derived from the job ID.
import { timingSafeEqual } from "node:crypto";
import { JOB_ID } from "./lib/http.mjs";
import { signJob } from "./agent-job.core.mjs";

const TERMINAL = new Set(["done", "failed"]);

export function makeBackgroundHandler({
  jobs, proposals, runStep, secret,
  maxSteps = 25,                 // tool-round cap from rate-limiting-cost-guards
  wallClockMs = 13 * 60 * 1000,  // stop before the 15 min background limit
  now = () => Date.now(),
}) {
  return async (req) => {
    const { id } = await req.json().catch(() => ({}));
    // The URL is public: only act on a job we created, with our signature.
    const given = Buffer.from(req.headers.get("x-job-signature") ?? "");
    const want = Buffer.from(typeof id === "string" ? signJob(secret, id) : "");
    if (!JOB_ID.test(id ?? "") || given.length !== want.length || !timingSafeEqual(given, want)) return;

    const started = now();
    for (;;) {
      const cur = await jobs.getWithMetadata(id, { type: "json", consistency: "strong" });
      if (!cur) return;
      const { data: job, etag } = cur;
      if (TERMINAL.has(job.status)) return;                       // retry after success: no-op
      // onlyIfMatch: undefined is silently an UNCONDITIONAL write. The local
      // BlobsServer (@netlify/blobs 11.1.11) returns no ETag on reads, so fail loudly.
      if (!etag) throw new Error("Blobs read returned no ETag; refusing unconditional write");

      if (job.step >= job.totalSteps) {                           // all work done -> finish
        const proposalId = `prop_${id.slice(4)}`;
        await proposals.setJSON(proposalId, {
          id: proposalId, jobId: id, agent: job.agent, status: "pending",
          summary: job.output.join(" | "), createdAt: new Date(now()).toISOString(),
        }, { onlyIfNew: true });                                  // modified:false on retry = already there, fine
        await jobs.setJSON(id, { ...job, status: "done", proposalId, updatedAt: new Date(now()).toISOString() },
                           { onlyIfMatch: etag });
        return;
      }
      if (job.step >= maxSteps || now() - started > wallClockMs) {
        await jobs.setJSON(id, { ...job, status: "paused", updatedAt: new Date(now()).toISOString() }, { onlyIfMatch: etag });
        return;
      }

      const result = await runStep(job);   // may throw -> Netlify retries; we resume at this step
      const next = { ...job, status: "running", step: job.step + 1, output: [...job.output, result],
                     updatedAt: new Date(now()).toISOString() };
      const w = await jobs.setJSON(id, next, { onlyIfMatch: etag });
      if (!w.modified) return;             // another run advanced the job first; let it continue
    }
  };
}
