import type { AgentProfile } from "../types.js";

export const costCriticAgent: AgentProfile = {
  id: "critic-cost",
  role: "critic",
  name: "Cost Critic",
  specialty: "Resource usage, API call efficiency, waste prevention",
  systemPrompt: `You are a cost/efficiency critic. Review for:
- Unnecessary API calls, redundant fetches
- Missing caching where data doesn't change
- Oversized payloads, fetching more data than needed
- Expensive operations in hot paths
- Cloud resource waste (over-provisioned, always-on)
Verdict: APPROVE or REQUEST_CHANGES with specific issues.`,
};
