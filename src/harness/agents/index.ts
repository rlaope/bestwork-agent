export type { AgentProfile } from "./types.js";
export { TECH_AGENTS } from "./tech/index.js";
export { PM_AGENTS } from "./pm/index.js";
export { CRITIC_AGENTS } from "./critic/index.js";

import { TECH_AGENTS } from "./tech/index.js";
import { PM_AGENTS } from "./pm/index.js";
import { CRITIC_AGENTS } from "./critic/index.js";
import type { AgentProfile } from "./types.js";
import { loadPrompt, loadPromptMeta } from "../prompt-loader.js";

export const ALL_AGENTS: AgentProfile[] = [
  ...TECH_AGENTS,
  ...PM_AGENTS,
  ...CRITIC_AGENTS,
];

export function getAgent(id: string): AgentProfile | undefined {
  return ALL_AGENTS.find((a) => a.id === id);
}

export function getAgentsByRole(
  role: "tech" | "pm" | "critic"
): AgentProfile[] {
  return ALL_AGENTS.filter((a) => a.role === role);
}

export async function getAgentWithPrompt(id: string): Promise<AgentProfile | null> {
  const agent = getAgent(id);
  if (!agent) return null;

  try {
    const name = agent.id.replace(`${agent.role}-`, "");
    const meta = await loadPromptMeta(agent.role, name);
    return {
      ...agent,
      systemPrompt: meta.prompt,
      costTier: meta.costTier,
      useWhen: meta.useWhen,
      avoidWhen: meta.avoidWhen,
    };
  } catch {
    return agent; // fallback to hardcoded
  }
}

export async function getTeamWithPrompts(ids: string[]): Promise<AgentProfile[]> {
  const results = await Promise.all(ids.map((id) => getAgentWithPrompt(id)));
  return results.filter((a): a is AgentProfile => a !== null);
}

export function formatAgentCatalog(): string {
  const lines: string[] = [];

  lines.push("\n  bestwork-agent Agent Catalog\n");

  lines.push("  TECH AGENTS (implementation):");
  for (const a of TECH_AGENTS) {
    lines.push(`    ${a.id.padEnd(22)} [${a.costTier}] ${a.specialty}`);
  }

  lines.push("\n  PM AGENTS (requirements verification):");
  for (const a of PM_AGENTS) {
    lines.push(`    ${a.id.padEnd(22)} [${a.costTier}] ${a.specialty}`);
  }

  lines.push("\n  CRITIC AGENTS (quality review):");
  for (const a of CRITIC_AGENTS) {
    lines.push(`    ${a.id.padEnd(22)} [${a.costTier}] ${a.specialty}`);
  }

  lines.push(
    `\n  Total: ${TECH_AGENTS.length} tech + ${PM_AGENTS.length} PM + ${CRITIC_AGENTS.length} critic = ${ALL_AGENTS.length} agents\n`
  );

  return lines.join("\n");
}
