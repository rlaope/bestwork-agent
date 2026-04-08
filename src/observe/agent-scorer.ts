import { saveAgentRun, loadAgentRuns } from "./agent-storage.js";
import type { AgentRun, AgentScore } from "../types/index.js";

export type { AgentRun, AgentScore };

function computeEffectiveness(
  successRate: number,
  avgRetries: number,
  avgDuration: number
): number {
  const speedScore = Math.max(0, 1 - avgDuration / 120000);
  return (
    successRate * 60 +
    Math.max(0, 1 - avgRetries / 3) * 20 +
    speedScore * 20
  );
}

function scoreFromRuns(agent: string, runs: AgentRun[]): AgentScore {
  const totalRuns = runs.length;
  const successRate =
    totalRuns > 0 ? runs.filter((r) => r.success).length / totalRuns : 0;
  const avgDuration =
    totalRuns > 0 ? runs.reduce((s, r) => s + r.duration, 0) / totalRuns : 0;
  const avgRetries =
    totalRuns > 0 ? runs.reduce((s, r) => s + r.retries, 0) / totalRuns : 0;
  const lastRun = runs.reduce((latest, r) =>
    r.timestamp > latest.timestamp ? r : latest
  ).timestamp;

  return {
    agent,
    totalRuns,
    successRate,
    avgDuration,
    avgRetries,
    lastRun,
    effectiveness: computeEffectiveness(successRate, avgRetries, avgDuration),
  };
}

export async function recordAgentRun(run: AgentRun): Promise<void> {
  await saveAgentRun(run);
}

export async function getAgentScores(): Promise<AgentScore[]> {
  const runs = await loadAgentRuns();
  if (runs.length === 0) return [];

  const byAgent = new Map<string, AgentRun[]>();
  for (const run of runs) {
    const group = byAgent.get(run.agent);
    if (group) {
      group.push(run);
    } else {
      byAgent.set(run.agent, [run]);
    }
  }

  const scores: AgentScore[] = [];
  for (const [agent, agentRuns] of byAgent) {
    scores.push(scoreFromRuns(agent, agentRuns));
  }

  scores.sort((a, b) => b.effectiveness - a.effectiveness);
  return scores;
}

export async function getAgentScore(
  agentName: string
): Promise<AgentScore | null> {
  const runs = await loadAgentRuns(agentName);
  if (runs.length === 0) return null;
  return scoreFromRuns(agentName, runs);
}
