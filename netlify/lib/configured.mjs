// Fail closed: the console Functions do nothing until ALL console settings are configured.
// Owner decisions 2026-11-26: v1 ships the public app; the console is set up later; console auth is
// Supabase Auth (bearer access token) limited to CONSOLE_ADMIN_EMAILS. A deploy without these variables
// must never authenticate anyone, call Supabase, call Claude, touch Blobs or touch GitHub.
import { env, jsonError } from "./http.mjs";
import { supabaseBase, adminEmails } from "./auth.mjs";

export const REQUIRED_CONSOLE_VARS = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "CONSOLE_ADMIN_EMAILS", "ANTHROPIC_API_KEY", "GITHUB_TOKEN"];

export function consoleConfigured() {
  const set = REQUIRED_CONSOLE_VARS.every((k) => { const v = env(k); return typeof v === "string" && v.trim().length > 0; });
  // Unusable values count as unset: SUPABASE_URL must be https, the admin list must name at least one email.
  return set && supabaseBase() !== null && adminEmails().length > 0;
}

/** Returns a 503 Response when the console is not configured, else null. Call FIRST in every handler. */
export function requireConfigured() {
  return consoleConfigured() ? null : jsonError(503, "not_configured", "console not configured");
}
