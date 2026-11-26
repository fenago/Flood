// Local smoke test (smoke-test-rollback skill, adapted to this container): serves dist/ plus the real
// /api handlers with MOCKED deps, then walks the checks. Part 1: console unconfigured (the v1 deploy
// state) must fail closed. Part 2: with local test config, login -> chat -> proposal -> approve works
// against in-memory Blobs, a scripted Claude and an in-memory GitHub. No network, no real keys.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`); };

async function withServer(port, env, fn) {
  const child = spawn(process.execPath, ["scripts/serve.mjs", "dist", String(port), "--functions"], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((resolve, reject) => { child.stdout.on("data", (d) => String(d).includes("Serving") && resolve()); child.on("exit", (c) => reject(new Error(`server exited ${c}`))); });
  try { await fn(`http://localhost:${port}`); } finally { child.kill(); }
}

// Part 1: production-like v1 deploy, console NOT configured.
await withServer(4180, { FW_SMOKE_UNCONFIGURED: "1" }, async (base) => {
  const root = await fetch(base + "/");
  const html = await root.text();
  check("GET / 200 with app root", root.status === 200 && html.includes('id="view"'));
  check("notice + Open-Meteo credit in shell", html.includes("not an official warning service") && html.includes("Weather data by Open-Meteo.com"));
  const man = await fetch(base + "/manifest.webmanifest");
  let manOk = false; try { const m = await man.json(); manOk = m.icons.length === 3 && m.display === "standalone"; } catch { /* invalid */ }
  check("GET /manifest.webmanifest 200 valid JSON", man.status === 200 && manOk);
  const sw = await fetch(base + "/sw.js");
  check("GET /sw.js 200 with stamped version", sw.status === 200 && /const VERSION = "[0-9a-f]{12}"/.test(await sw.text()));
  check("GET /config/scoring.json + /data/cities.json 200", (await fetch(base + "/config/scoring.json")).status === 200 && (await fetch(base + "/data/cities.json")).status === 200);
  for (const [path, init] of [["/api/agents", {}], ["/api/session", {}], ["/api/auth-login", { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: '{"password":"x"}' }]]) {
    const r = await fetch(base + path, init);
    const b = await r.json();
    check(`unconfigured ${init.method ?? "GET"} ${path} -> 503 console not configured`, r.status === 503 && b.error.message === "console not configured");
  }
});

// Part 2: local test configuration (mocked Claude/GitHub/Blobs).
await withServer(4181, {}, async (base) => {
  const r401 = await fetch(base + "/api/agents");
  check("GET /api/agents 401 without session", r401.status === 401);
  const { DEV_PASSWORD } = await import("./dev-functions.mjs");
  const login = await fetch(base + "/api/auth-login", { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: JSON.stringify({ password: DEV_PASSWORD }) });
  const { csrfToken } = await login.json();
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  check("login 200 sets __Host-fw_session", login.status === 200 && cookie.startsWith("__Host-fw_session="));
  const h = { origin: base, cookie, "x-csrf-token": csrfToken, "content-type": "application/json" };
  const agents = await (await fetch(base + "/api/agents", { headers: { cookie } })).json();
  check("GET /api/agents with session lists 12 agents", agents.agents?.length === 12);
  let conv = null, proposalId = null, input = { type: "message", text: "Please add a line to the decisions log." };
  for (let turn = 0; turn < 4; turn++) {
    const res = await fetch(base + "/api/agent-chat", { method: "POST", headers: h, body: JSON.stringify({ agent: "orchestrator", conversationId: conv, turnId: randomUUID(), input }) });
    const events = (await res.text()).split("\n\n").filter((b) => b.startsWith("event:")).map((b) => ({ event: b.split("\n")[0].slice(7), data: JSON.parse(b.split("\n")[1].slice(6)) }));
    conv = events[0]?.data.conversationId ?? conv;
    proposalId = events.find((e) => e.event === "proposal")?.data.proposalId ?? proposalId;
    const done = events.find((e) => e.event === "done");
    if (!done || done.data.next !== "continue") break;
    input = { type: "continue" };
  }
  check("chat streamed turns and produced a pending proposal", Boolean(proposalId), proposalId ?? "none");
  const view = await (await fetch(`${base}/api/proposals?id=${proposalId}`, { headers: { cookie } })).json();
  check("proposal view has before/after for the diff", view.proposal?.files?.[0]?.before?.includes("Old line.") && view.proposal.files[0].after.includes("New line"));
  const ap = await fetch(base + "/api/proposal-approve", { method: "POST", headers: h, body: JSON.stringify({ id: proposalId }) });
  const apb = await ap.json();
  check("approve -> 200 committed (mock GitHub)", ap.status === 200 && apb.status === "committed", apb.commitSha?.slice(0, 7));
  const again = await fetch(base + "/api/proposal-approve", { method: "POST", headers: h, body: JSON.stringify({ id: proposalId }) });
  check("replayed approve -> 409", again.status === 409);
});

const failed = results.filter((r) => !r.ok).length;
console.log(`\nsmoke: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
