// Prints a CONSOLE_PASSWORD_HASH (scrypt N=2^17, r=8, p=1) and a fresh SESSION_SECRET.
// The password is read from the terminal without echo and is never written anywhere.
// Usage: npm run hash-password
import { hashPassword } from "../netlify/lib/session.mjs";
import { randomBytes } from "node:crypto";
import readline from "node:readline";

async function ask(q) {
  if (!process.stdin.isTTY) { let s = ""; for await (const c of process.stdin) s += c; return s.replace(/\r?\n$/, ""); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (str) => { if (str.includes(q)) process.stdout.write(str); };
  return new Promise((res) => rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); res(a); }));
}
const pw = await ask("Console password (min 12 characters): ");
if (pw.length < 12) { console.error("Use at least 12 characters."); process.exit(1); }
console.log(`CONSOLE_PASSWORD_HASH=${await hashPassword(pw)}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
