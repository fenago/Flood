// Scripted stand-in for the @anthropic-ai/sdk client: client.messages.stream(params) returns an object
// with on("text"), finalMessage() and abort(), like the SDK's MessageStream. No network, no key.
export function mockClaude(script = []) {
  const calls = [];
  let i = 0;
  const client = {
    messages: {
      stream(params) {
        calls.push(structuredClone(params));
        const step = script[Math.min(i++, script.length - 1)] ?? { text: "ok" };
        const handlers = [];
        let aborted = false;
        let rejectFn;
        const final = new Promise((resolve, reject) => {
          rejectFn = reject;
          setImmediate(async () => {
            if (step.throw) return reject(step.throw);
            for (const t of [].concat(step.chunks ?? (step.text ? [step.text] : []))) {
              if (aborted) return;
              handlers.forEach((h) => h(t));
              await new Promise((r) => setImmediate(r));
            }
            if (step.hang) return; // never resolves unless aborted
            const content = [];
            if (step.text || step.chunks) content.push({ type: "text", text: [].concat(step.chunks ?? step.text).join("") });
            for (const [k, tu] of (step.toolUses ?? []).entries()) content.push({ type: "tool_use", id: `toolu_${i}_${k}`, name: tu.name, input: tu.input });
            resolve({ id: `msg_${i}`, type: "message", role: "assistant", model: params.model, content,
              stop_reason: step.stop_reason ?? (step.toolUses?.length ? "tool_use" : "end_turn"),
              usage: { input_tokens: step.inputTokens ?? 100, output_tokens: step.outputTokens ?? 20 } });
          });
        });
        return {
          on(ev, h) { if (ev === "text") handlers.push(h); return this; },
          finalMessage: () => final,
          abort() { aborted = true; rejectFn(Object.assign(new Error("aborted"), { name: "APIUserAbortError" })); },
        };
      },
    },
  };
  return { client, calls };
}
