// One Claude turn per request (long-running-agent-jobs skill, pattern 1). The browser drives the loop:
// when a turn ends with tool_use, tools run here, results are saved, and the client posts "continue".
import { randomBytes } from "node:crypto";
import { AGENT_TOOLS, CONSOLE_PREAMBLE } from "./tools.mjs";
import { readPathProblem, validateProposal } from "./allowlist.mjs";
import { readFileAt, listTree } from "./github.mjs";
import { openStore } from "./blobs.mjs";
import { deps } from "./deps.mjs";

export const MAX_TOKENS = 16000;
export const DEADLINE_MS = 50_000; // Netlify sync limit is 60 s, streamed responses included
export const MAX_READ_CHARS = 100_000;

export async function runClaudeTurn({ client, agent, model, effort, messages, onText, deadlineMs = DEADLINE_MS }) {
  const stream = client.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort },
    system: [{ type: "text", text: `${CONSOLE_PREAMBLE}\n\n${agent.prompt}`, cache_control: { type: "ephemeral" } }],
    tools: AGENT_TOOLS,
    tool_choice: { type: "auto" }, // forced tool_choice returns 400 on Opus/Sonnet 5.5
    messages,
  });
  let text = "";
  let deadlineHit = false;
  stream.on("text", (d) => { text += d; onText(d); });
  const timer = setTimeout(() => { deadlineHit = true; stream.abort(); }, deadlineMs);
  try {
    const message = await stream.finalMessage();
    return { message };
  } catch (err) {
    if (deadlineHit) return { deadline: true, partialText: text };
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const newId = (prefix) => `${prefix}_${randomBytes(15).toString("base64url")}`;

/** Execute tool_use blocks; returns tool_result blocks (all in ONE user message). */
export async function runTools({ calls, gh, ghCfg, record, context, emit }) {
  const results = [];
  let treeCache = null;
  for (const call of calls) {
    const done = (content, isError = false, summary = "") => {
      results.push({ type: "tool_result", tool_use_id: call.id, content, ...(isError ? { is_error: true } : {}) });
      emit("tool", { callId: call.id, name: call.name, status: isError ? "error" : "ok", summary: summary.slice(0, 200) });
    };
    emit("tool", { callId: call.id, name: call.name, status: "started", summary: "" });
    try {
      if (call.name === "read_file") {
        const p = call.input?.path;
        const why = readPathProblem(p);
        if (why) { done(`Cannot read ${JSON.stringify(p)}: ${why}`, true, `read refused: ${why}`); continue; }
        if (!gh) { done("GitHub is not configured for this console.", true, "GitHub not configured"); continue; }
        const text = await readFileAt(gh, ghCfg, p, record.baseSha);
        if (text === null) { done(`${p} does not exist at ${record.baseSha.slice(0, 7)}.`, true, `${p}: not found`); continue; }
        done(text.length > MAX_READ_CHARS ? `${text.slice(0, MAX_READ_CHARS)}\n[truncated]` : text, false, `read ${p}`);
      } else if (call.name === "list_files") {
        const prefix = String(call.input?.prefix ?? "");
        if (prefix.length > 200) { done("Prefix too long.", true, "bad prefix"); continue; }
        if (!gh) { done("GitHub is not configured for this console.", true, "GitHub not configured"); continue; }
        treeCache ??= await listTree(gh, ghCfg, record.baseSha);
        const paths = treeCache.filter((p) => p.startsWith(prefix) && readPathProblem(p) === null).slice(0, 300);
        done(paths.join("\n") || "(no readable files)", false, `listed ${paths.length} files`);
      } else if (call.name === "propose_change") {
        const input = call.input ?? {};
        const problems = validateProposal(input);
        if (typeof input.summary !== "string" || input.summary.trim().length === 0 || input.summary.length > 200) problems.push("summary must be 1-200 characters");
        if (!record.baseSha) problems.push("no base commit (GitHub not configured)");
        if (problems.length) { done(`Proposal rejected: ${problems.join("; ")}`, true, "proposal rejected"); continue; }
        const id = newId("p");
        const now = deps.now();
        const proposal = {
          schemaVersion: 1, id, status: "pending", agent: record.agent, conversationId: record.id, baseSha: record.baseSha,
          summary: input.summary.trim(), files: input.files.map((f) => ({ path: f.path, content: f.content })),
          createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 7 * 864e5).toISOString(),
        };
        const res = await openStore("proposals", context).setJSON(id, proposal, { onlyIfNew: true });
        if (!res?.modified) { done("Could not store the proposal; try again.", true, "store failed"); continue; }
        emit("proposal", { proposalId: id, summary: proposal.summary, files: proposal.files.map((f) => ({ path: f.path, bytes: Buffer.byteLength(f.content) })) });
        done(`Stored proposal ${id} as pending. A human must review and approve it before anything is committed.`, false, `proposal ${id}`);
      } else {
        done(`Unknown tool ${call.name}`, true, "unknown tool");
      }
    } catch (e) {
      done(`Tool failed: ${e?.status ? `upstream ${e.status}` : "error"}`, true, "tool failed");
    }
  }
  return results;
}

const CONV_ID = /^c_[A-Za-z0-9_-]{16,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_MESSAGES = 400;
export const MAX_ROUNDS = 25;
export const LOCK_MS = 70_000;

export function validateChatBody(b) {
  const keys = Object.keys(b);
  if (keys.some((k) => !["agent", "conversationId", "turnId", "input"].includes(k))) return "unknown field";
  if (typeof b.agent !== "string") return "agent";
  if (!(b.conversationId === null || (typeof b.conversationId === "string" && CONV_ID.test(b.conversationId)))) return "conversationId";
  if (typeof b.turnId !== "string" || !UUID.test(b.turnId)) return "turnId";
  const i = b.input;
  if (!i || typeof i !== "object") return "input";
  if (i.type === "message") {
    if (Object.keys(i).some((k) => !["type", "text"].includes(k))) return "input";
    if (typeof i.text !== "string" || i.text.trim().length === 0 || i.text.length > 8000) return "input.text";
  } else if (i.type === "continue") {
    if (Object.keys(i).length !== 1 || b.conversationId === null) return "input";
  } else return "input.type";
  return null;
}

