import { saveAllocation, loadAllocations } from "./allocation-history.js";
import type { AllocationOutcome, OptimizationStatus } from "../types/index.js";

const MIN_TOTAL_ALLOCATIONS = 10;
const MIN_AGENT_RUNS = 3;

export async function recordAllocation(entry: AllocationOutcome): Promise<void> {
  await saveAllocation(entry);
}

export async function getOptimalAgent(domain: string): Promise<string | null> {
  const entries = await loadAllocations(domain);

  if (entries.length === 0) {
    return null;
  }

  const agentStats: Record<string, { successes: number; total: number }> = {};

  for (const entry of entries) {
    if (!agentStats[entry.agent]) {
      agentStats[entry.agent] = { successes: 0, total: 0 };
    }
    agentStats[entry.agent].total += 1;
    if (entry.success) {
      agentStats[entry.agent].successes += 1;
    }
  }

  let bestAgent: string | null = null;
  let bestRate = -1;

  for (const [agent, stats] of Object.entries(agentStats)) {
    if (stats.total < MIN_AGENT_RUNS) {
      continue;
    }
    const rate = stats.successes / stats.total;
    if (rate > bestRate) {
      bestRate = rate;
      bestAgent = agent;
    }
  }

  return bestAgent;
}

export async function getOptimizationStatus(): Promise<OptimizationStatus> {
  const all = await loadAllocations();
  const totalAllocations = all.length;

  const domainMap: Record<string, Record<string, { successes: number; total: number }>> = {};

  for (const entry of all) {
    if (!domainMap[entry.domain]) {
      domainMap[entry.domain] = {};
    }
    if (!domainMap[entry.domain][entry.agent]) {
      domainMap[entry.domain][entry.agent] = { successes: 0, total: 0 };
    }
    domainMap[entry.domain][entry.agent].total += 1;
    if (entry.success) {
      domainMap[entry.domain][entry.agent].successes += 1;
    }
  }

  const topAgentPerDomain: Record<string, { agent: string; successRate: number }> = {};

  for (const [domain, agents] of Object.entries(domainMap)) {
    let bestAgent = "";
    let bestRate = -1;

    for (const [agent, stats] of Object.entries(agents)) {
      const rate = stats.successes / stats.total;
      if (rate > bestRate) {
        bestRate = rate;
        bestAgent = agent;
      }
    }

    if (bestAgent) {
      topAgentPerDomain[domain] = { agent: bestAgent, successRate: bestRate };
    }
  }

  return {
    totalAllocations,
    domainsTracked: Object.keys(domainMap).length,
    topAgentPerDomain,
    hasEnoughData: totalAllocations >= MIN_TOTAL_ALLOCATIONS,
  };
}
