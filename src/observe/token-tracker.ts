import { appendFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import * as os from "node:os";
import type { TokenUsage, TokenStats, AgentTokenStats } from "../types/index.js";

function analyticsDir(): string {
  return join(os.homedir(), ".bestwork", "analytics");
}

function tokenLogFile(): string {
  return join(analyticsDir(), "token-log.jsonl");
}

export async function recordTokenUsage(entry: TokenUsage): Promise<void> {
  const dir = analyticsDir();
  await mkdir(dir, { recursive: true });
  await appendFile(tokenLogFile(), JSON.stringify(entry) + "\n", "utf8");
}

async function loadTokenLog(): Promise<TokenUsage[]> {
  let raw: string;
  try {
    raw = await readFile(tokenLogFile(), "utf8");
  } catch {
    return [];
  }

  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as TokenUsage);
}

export async function getTokenStats(): Promise<TokenStats[]> {
  const entries = await loadTokenLog();
  if (entries.length === 0) return [];

  const bySkill = new Map<string, { tokens: number; tasks: number }>();
  for (const entry of entries) {
    const current = bySkill.get(entry.skill) ?? { tokens: 0, tasks: 0 };
    bySkill.set(entry.skill, {
      tokens: current.tokens + entry.tokens,
      tasks: current.tasks + entry.tasksCompleted,
    });
  }

  const stats: TokenStats[] = [];
  for (const [skill, agg] of bySkill) {
    stats.push({
      skill,
      totalTokens: agg.tokens,
      totalTasks: agg.tasks,
      avgTokensPerTask: agg.tasks > 0 ? agg.tokens / agg.tasks : 0,
    });
  }

  return stats;
}

export async function getAgentTokenStats(): Promise<AgentTokenStats[]> {
  const entries = await loadTokenLog();
  if (entries.length === 0) return [];

  const byAgent = new Map<string, { tokens: number; tasks: number }>();
  for (const entry of entries) {
    const current = byAgent.get(entry.agent) ?? { tokens: 0, tasks: 0 };
    byAgent.set(entry.agent, {
      tokens: current.tokens + entry.tokens,
      tasks: current.tasks + entry.tasksCompleted,
    });
  }

  const stats: AgentTokenStats[] = [];
  for (const [agent, agg] of byAgent) {
    stats.push({
      agent,
      totalTokens: agg.tokens,
      totalTasks: agg.tasks,
      avgTokensPerTask: agg.tasks > 0 ? agg.tokens / agg.tasks : 0,
    });
  }

  return stats;
}
