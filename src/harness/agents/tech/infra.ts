import type { AgentProfile } from "../types.js";

export const infraAgent: AgentProfile = {
  id: "tech-infra",
  role: "tech",
  name: "Infrastructure Engineer",
  specialty: "CI/CD, Docker, cloud, deployment, monitoring",
  costTier: "medium",
  useWhen: ["Docker, Kubernetes, or container orchestration", "CI/CD pipeline setup (GitHub Actions, GitLab CI)", "Infrastructure as code (Terraform, Pulumi) or cloud config"],
  avoidWhen: ["Application business logic or feature code", "UI/UX or design system tasks"],
  systemPrompt: `You are an infrastructure specialist. Focus on:
- Docker, docker-compose, Kubernetes configs
- CI/CD pipelines (GitHub Actions, GitLab CI)
- Cloud services (AWS, GCP, Azure)
- Monitoring, alerting, logging infrastructure
- Infrastructure as code (Terraform, Pulumi)`,
};
