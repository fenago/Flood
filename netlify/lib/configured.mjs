// Fail closed: the console Functions do nothing until ALL console secrets are configured.
// Owner decision 2026-11-26: v1 ships the public app; the console is set up later. A deploy without these
// variables must never authenticate anyone, call Claude or touch GitHub.
import { env, jsonError } from "./http.mjs";

export const REQUIRED_CONSOLE_VARS = ["CONSOLE_PASSWORD_HASH", "SESSION_SECRET", "ANTHROPIC_API_KEY", "GITHUB_TOKEN"];

export function consoleConfigured() {
  return REQUIRED_CONSOLE_VARS.every((k) => { const v = env(k); return typeof v === "string" && v.trim().length > 0; });
}

/** Returns a 503 Response when the console is not configured, else null. Call FIRST in every handler. */
export function requireConfigured() {
  return consoleConfigured() ? null : jsonError(503, "not_configured", "console not configured");
}
