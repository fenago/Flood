// Daily Claude token budget (rate-limiting-cost-guards skill). Counter per America/New_York day.
import { openStore, incrementCounter } from "./blobs.mjs";
import { env } from "./http.mjs";
import { deps } from "./deps.mjs";

export const DEFAULT_DAILY_TOKEN_BUDGET = 1_000_000;
const day = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(deps.now());

export function dailyBudget() {
  const n = Number(env("DAILY_TOKEN_BUDGET"));
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_TOKEN_BUDGET;
}
export async function tokensUsedToday(context) {
  const rec = await openStore("counters", context).get(`tokens/${day()}`);
  return rec?.n ?? 0;
}
export async function addTokens(context, usage) {
  const n = (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0);
  if (n > 0) await incrementCounter(openStore("counters", context), `tokens/${day()}`, n);
  return n;
}
export function secondsToMidnight() {
  const now = deps.now();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(now).map((p) => [p.type, p.value]));
  return 86400 - (+parts.hour * 3600 + +parts.minute * 60 + +parts.second);
}
