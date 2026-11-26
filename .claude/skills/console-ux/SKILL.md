---
name: console-ux
description: Design the Agent Console experience - agent list cards, chat, job progress, diff review and the Approve and deploy confirmation. Use when designing or building any /console screen.
user-invocable: false
---
# Agent Console UX

- Login: one password field, clear error, lockout message with time remaining.
- Agent list: card per agent with name, model, personality line, description; tap to chat.
- Chat: streaming text, "Stop" button, tool activity shown as plain lines ("Reading src/scoring/beach.js"), job progress for background jobs.
- Proposal: summary, file list with +/− counts, side-by-side diff with a unified toggle, warnings for new network domains or scripts.
- Approve button says exactly what happens: "Approve and deploy 2 files to production". Confirmation sheet; disabled while committing; then show commit link and "Deploying…" status.
- Reject with optional note sent back to the agent.
- States: rate-limited, budget reached, stale proposal (main changed), commit failed — each with a next step.
