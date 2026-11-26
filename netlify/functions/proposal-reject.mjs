// POST /api/proposal-reject {id, note?} - pending -> rejected (conditional write). Session + CSRF required.
import { json, jsonError, readJsonBody } from "../lib/http.mjs";
import { requireWrite } from "../lib/session.mjs";
import { rateLimit } from "../lib/ratelimit.mjs";
import { openStore, casUpdate, StorageError } from "../lib/blobs.mjs";
import { deps } from "../lib/deps.mjs";
import { PROPOSAL_ID } from "../lib/ids.mjs";

export const config = { path: "/api/proposal-reject", method: "POST" };

export default async (req, context) => {
  const limited = await rateLimit("proposal-reject", context);
  if (limited) return limited;
  const auth = await requireWrite(req, context);
  if (auth.response) return auth.response;
  const { body, error } = await readJsonBody(req, 8192);
  if (error) return error;
  if (typeof body.id !== "string" || !PROPOSAL_ID.test(body.id)) return jsonError(400, "bad_request", "Invalid id");
  const note = typeof body.note === "string" ? body.note.slice(0, 1000) : "";
  try {
    const r = await casUpdate(openStore("proposals", context), body.id, (p) => (p.status === "pending" ? { ...p, status: "rejected", note, rejectedAt: deps.now().toISOString() } : undefined));
    if (!r.ok) return r.current ? jsonError(409, "already_processed", `Proposal is ${r.current.status}`, { status: r.current.status }) : jsonError(404, "not_found", "No such proposal");
    return json(200, { ok: true, status: "rejected" });
  } catch (e) {
    if (e instanceof StorageError) return jsonError(503, "storage_unavailable", "Try again shortly", { retryAfterSeconds: 5 });
    return jsonError(500, "internal", "Something went wrong");
  }
};
