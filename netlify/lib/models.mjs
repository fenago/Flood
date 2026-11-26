// Alias -> Claude API model ID (agent-model-mapping skill; docs/04 section 1). One place only.
export const MODEL_MAP = { opus: "claude-opus-5-5", inherit: "claude-opus-5-5", sonnet: "claude-sonnet-5-5", haiku: "claude-haiku-5-5", fable: "claude-fable-5-2" };
export const ALLOWED_MODELS = new Set(Object.values(MODEL_MAP));
export const DEFAULT_MODEL = "claude-opus-5-5";
export const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);

export function mapModel(value) {
  if (!value) return DEFAULT_MODEL;
  if (MODEL_MAP[value]) return MODEL_MAP[value];
  if (ALLOWED_MODELS.has(value)) return value;
  console.warn(`agent model "${String(value).slice(0, 40)}" not allowed; using ${DEFAULT_MODEL}`);
  return DEFAULT_MODEL;
}
export const mapEffort = (e) => (EFFORTS.has(e) ? e : "medium");
