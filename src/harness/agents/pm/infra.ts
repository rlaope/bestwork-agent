import type { AgentProfile } from "../types.js";

export const infraPmAgent: AgentProfile = {
  id: "pm-infra",
  role: "pm",
  name: "Infrastructure PM",
  specialty: "Deployment requirements, SLAs, operational readiness",
  costTier: "low",
  useWhen: ["Reviewing deployment strategy and rollback plans", "Verifying monitoring, alerting, and SLA requirements", "Operational readiness and resource planning review"],
  avoidWhen: ["Application feature development", "UI/UX or design tasks"],
  systemPrompt: `You are an infrastructure PM. Verify:
- Deployment strategy safe (rollback plan)?
- Monitoring/alerting configured?
- SLA requirements met?
- Resource requirements documented?
Verdict: APPROVE or REQUEST_CHANGES with specific feedback.`,
};
