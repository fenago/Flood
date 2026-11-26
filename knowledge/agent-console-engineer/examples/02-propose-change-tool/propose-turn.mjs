// One agent turn with the strict `propose_change` tool.
// - tool_choice is "auto": forced "any"/"tool" returns 400 on Opus 5.5 and Sonnet 5.5.
// - strict: true keeps the input schema-valid, but it is still untrusted model
//   output, so paths go through the allow-list before anything is stored.
// - The tool never writes to GitHub; it only stores a pending proposal.
import Anthropic from "@anthropic-ai/sdk";
import { validateProposal } from "./allowlist.mjs";

export const PROPOSE_CHANGE = {
  name: "propose_change",
  description:
    "Propose edits to Flood Watch files for the owner to review. Nothing is committed " +
    "until a human approves. Only public/, src/, tests/ and docs/ files can be changed. " +
    "Send the full new content of each file.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One-line summary for the commit message" },
      files: {
        type: "array",
        description: "Files to create or replace (max 10, enforced server-side)",
        items: {
          type: "object",
          properties: {
            path: { type: "string", description: "Repo-relative path, e.g. docs/decisions.md" },
            content: { type: "string", description: "Complete new UTF-8 file content" },
          },
          required: ["path", "content"],
          additionalProperties: false,
        },
      },
    },
    required: ["summary", "files"],
    additionalProperties: false,
  },
};

/** Runs one streamed turn; returns the assistant message and the tool_result blocks to send back. */
export async function runTurn({ client, system, messages, saveProposal }) {
  const stream = client.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" }, // code-writing agent
    system,
    tools: [PROPOSE_CHANGE],
    tool_choice: { type: "auto" },
    messages,
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") return { message, toolResults: [], outcome: "refusal" };
  const calls = message.content.filter((b) => b.type === "tool_use");
  // A tool input cut off at max_tokens can still look valid: never act on it.
  if (message.stop_reason === "max_tokens" && calls.length) {
    return { message, toolResults: [], outcome: "truncated" };
  }
  if (calls.length === 0) return { message, toolResults: [], outcome: "no-proposal" };

  const toolResults = [];
  for (const call of calls) {
    if (call.name !== "propose_change") {
      toolResults.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Unknown tool ${call.name}` });
      continue;
    }
    const errors = validateProposal(call.input);
    if (errors.length) {
      toolResults.push({
        type: "tool_result", tool_use_id: call.id, is_error: true,
        content: `Proposal rejected: ${errors.join("; ")}`,
      });
      continue;
    }
    const id = await saveProposal({ ...call.input, status: "pending" });
    toolResults.push({
      type: "tool_result", tool_use_id: call.id,
      content: `Stored proposal ${id} as pending. A human must approve it before anything is committed.`,
    });
  }
  // All tool_result blocks go back together in ONE user message on the next request.
  return { message, toolResults, outcome: toolResults.some((r) => r.is_error) ? "rejected" : "stored" };
}
