// Agent definitions compiled at build time from .claude/agents/*.md (scripts/build-agents-manifest.mjs).
import { AGENTS } from "./agents.generated.mjs";

export const AGENT_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const listAgents = () => AGENTS.map(({ name, description, model, personality }) => ({ name, description, model, personality }));
export const getAgent = (name) => (AGENT_NAME.test(name ?? "") ? AGENTS.find((a) => a.name === name) ?? null : null);
