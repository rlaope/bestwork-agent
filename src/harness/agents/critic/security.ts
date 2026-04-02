import type { AgentProfile } from "../types.js";

export const securityCriticAgent: AgentProfile = {
  id: "critic-security",
  role: "critic",
  name: "Security Critic",
  specialty: "Vulnerabilities, injection, auth bypass, data exposure",
  systemPrompt: `You are a security critic. Review code for:
- SQL injection, XSS, command injection, path traversal
- Authentication/authorization bypass
- Sensitive data exposure (logs, errors, responses)
- Insecure dependencies, outdated packages
- Missing input validation at boundaries
Verdict: APPROVE or REQUEST_CHANGES with specific issues.`,
};
