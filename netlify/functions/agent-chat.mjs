// POST /api/agent-chat - one streamed Claude turn (SSE). Session + Origin + CSRF required.
// Spec: knowledge/software-architect/examples/02-agent-chat-interface-spec.md
import { requireConfigured } from "../lib/configured.mjs";
import { randomBytes } from "node:crypto";
import { jsonError, env, readJsonBody, SSE_HEADERS } from "../lib/http.mjs";
import { requireWrite } from "../lib/session.mjs";
import { openStore, casUpdate, StorageError } from "../lib/blobs.mjs";
import { getAgent } from "../lib/agents.mjs";
import { mapModel, mapEffort } from "../lib/models.mjs";
import { dailyBudget, tokensUsedToday, addTokens, secondsToMidnight } from "../lib/budget.mjs";
import { githubConfig, makeGitHub, headSha } from "../lib/github.mjs";
import { runClaudeTurn, runTools, validateChatBody, MAX_MESSAGES, MAX_ROUNDS, LOCK_MS } from "../lib/chat.mjs";
import { sseStream } from "../lib/sse.mjs";
import { deps } from "../lib/deps.mjs";

export const config = {
  path: "/api/agent-chat",
  method: "POST",
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] }, // Netlify rule 2 of 2
};

export default async (req, context) => {
  const off = requireConfigured(); // fail closed before any Blobs, Claude or GitHub access
  if (off) return off;
  if (req.method !== "POST") return jsonError(405, "method_not_allowed", "POST only", {}, { allow: "POST" });
  const auth = await requireWrite(req, context);
  if (auth.response) return auth.response;
  const { body, error } = await readJsonBody(req);
  if (error) return error;
  const bad = validateChatBody(body);
  if (bad) return jsonError(400, "bad_request", `Invalid field: ${bad}`);
  const agent = getAgent(body.agent);
  if (!agent) return jsonError(404, "unknown_agent", "No such agent");
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return jsonError(503, "not_configured", "Claude API is not configured");

  const chats = openStore("chats", context);
  let id = body.conversationId;
  try {
    if ((await tokensUsedToday(context)) >= dailyBudget()) {
      return jsonError(429, "budget_exhausted", "Daily token budget reached", { retryAfterSeconds: secondsToMidnight() });
    }
    const ghCfg = githubConfig();
    const gh = ghCfg ? makeGitHub(ghCfg) : null;
    if (id === null) {
      id = `c_${randomBytes(18).toString("base64url")}`;
      const baseSha = gh ? await headSha(gh, ghCfg).catch(() => null) : null;
      const rec = { schemaVersion: 1, id, agent: agent.name, baseSha, messages: [], processedTurnIds: [], status: "idle", rounds: 0, createdAt: deps.now().toISOString() };
      const r = await chats.setJSON(id, rec, { onlyIfNew: true });
      if (!r?.modified) return jsonError(409, "conversation_busy", "Try again", { retryAfterSeconds: 1 });
    }
    // Lock the conversation (conditional write) so two tabs cannot run turns at once.
    const nowMs = deps.now().getTime();
    let refusal = null;
    const lock = await casUpdate(chats, id, (rec) => {
      if (rec.agent !== agent.name) { refusal = jsonError(400, "bad_request", "Conversation belongs to another agent"); return undefined; }
      if (rec.processedTurnIds.includes(body.turnId)) { refusal = jsonError(409, "duplicate_turn", "This turn was already processed"); return undefined; }
      if (rec.status === "running" && nowMs - Date.parse(rec.runningSince) < LOCK_MS) { refusal = jsonError(409, "conversation_busy", "Another turn is running", { retryAfterSeconds: 5 }); return undefined; }
      if (rec.messages.length >= MAX_MESSAGES) { refusal = jsonError(409, "conversation_full", "Start a new conversation"); return undefined; }
      if (body.input.type === "continue" && rec.rounds >= MAX_ROUNDS) { refusal = jsonError(409, "round_limit", "25 tool rounds reached; send a message to go on"); return undefined; }
      return { ...rec, status: "running", runningSince: new Date(nowMs).toISOString() };
    });
    if (!lock.ok) return refusal ?? (lock.current ? jsonError(409, "conversation_busy", "Try again", { retryAfterSeconds: 2 }) : jsonError(404, "unknown_conversation", "No such conversation"));
    const record = lock.value;

    // Build the message list for this turn.
    const messages = [...record.messages];
    const last = messages[messages.length - 1];
    const userText = body.input.type === "message" ? body.input.text : "Please continue.";
    if (body.input.type === "continue" && last?.role === "user") { /* tool results are already the last user message */ }
    else if (last?.role === "user") messages[messages.length - 1] = { role: "user", content: [...(Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content }]), { type: "text", text: userText }] };
    else messages.push({ role: "user", content: [{ type: "text", text: userText }] });

    const sse = sseStream();
    const model = mapModel(agent.model);
    (async () => {
      let saved = { messages, rounds: body.input.type === "message" ? 0 : record.rounds + 1 };
      let doneEvent = null;
      try {
        sse.send("start", { conversationId: id, turn: record.processedTurnIds.length + 1, turnId: body.turnId, agent: agent.name, model });
        const client = deps.anthropic(apiKey);
        const out = await runClaudeTurn({ client, agent, model, effort: mapEffort(agent.effort), messages, onText: (d) => sse.send("text", { delta: d }) });
        if (out.deadline) {
          if (out.partialText) saved.messages = [...messages, { role: "assistant", content: [{ type: "text", text: out.partialText }] }];
          doneEvent = { stopReason: "deadline", next: "continue", usage: null };
        } else {
          const m = out.message;
          await addTokens(context, m.usage).catch(() => {});
          const next = [...messages, { role: "assistant", content: m.content }];
          let stopReason = m.stop_reason;
          if (m.stop_reason === "tool_use") {
            const calls = m.content.filter((b) => b.type === "tool_use");
            const results = await runTools({ calls, gh, ghCfg, record, context, emit: (e, d) => sse.send(e, d) });
            next.push({ role: "user", content: results });
          } else if (m.stop_reason === "max_tokens" && m.content.some((b) => b.type === "tool_use")) {
            // A truncated tool call can look valid: never act on it. Drop it and let the owner continue.
            next[next.length - 1] = { role: "assistant", content: m.content.filter((b) => b.type !== "tool_use") };
          }
          saved.messages = next;
          const continueOn = new Set(["tool_use", "pause_turn"]);
          doneEvent = { stopReason, next: continueOn.has(stopReason) ? "continue" : "none", usage: { inputTokens: m.usage?.input_tokens ?? 0, outputTokens: m.usage?.output_tokens ?? 0 } };
        }
      } catch (e) {
        const status = e?.status;
        sse.send("error", { error: { code: "claude_unavailable", message: "The agent could not answer. Try again in a minute.", retryable: true, ...(status ? { upstreamStatus: status } : {}) } });
        saved = { messages: record.messages, rounds: record.rounds };
      }
      try {
        await casUpdate(chats, id, (rec) => ({
          ...rec, messages: saved.messages, rounds: saved.rounds, status: "idle", runningSince: null,
          processedTurnIds: [...rec.processedTurnIds, body.turnId].slice(-50), updatedAt: deps.now().toISOString(),
        }));
      } catch { /* lock expires after 70 s */ }
      if (doneEvent) sse.send("done", doneEvent);
      sse.close();
    })();
    return new Response(sse.stream, { status: 200, headers: SSE_HEADERS });
  } catch (e) {
    if (e instanceof StorageError) return jsonError(503, "storage_unavailable", "Try again shortly", { retryAfterSeconds: 5 });
    return jsonError(500, "internal", "Something went wrong");
  }
};

