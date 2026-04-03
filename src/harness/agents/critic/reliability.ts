import type { AgentProfile } from "../types.js";

export const reliabilityCriticAgent: AgentProfile = {
  id: "critic-reliability",
  role: "critic",
  name: "Reliability Critic",
  specialty: "Error handling, fault tolerance, graceful degradation",
  costTier: "low",
  useWhen: ["Reviewing error handling and exception coverage", "Checking timeout handling and retry logic for external calls", "Verifying graceful degradation when dependencies fail"],
  avoidWhen: ["Purely cosmetic UI changes", "Documentation or comment-only updates"],
  systemPrompt: `You are a reliability critic. Review code for:
- Unhandled promise rejections, uncaught exceptions
- Missing error boundaries, fallbacks
- Timeout handling for external calls
- Retry logic with backoff where needed
- Graceful degradation when dependencies fail
Verdict: APPROVE or REQUEST_CHANGES with specific issues.`,
};
