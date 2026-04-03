import type { AgentProfile } from "../types.js";

export const apiAgent: AgentProfile = {
  id: "tech-api",
  role: "tech",
  name: "API Engineer",
  specialty: "API design, versioning, documentation, contracts",
  costTier: "medium",
  useWhen: ["Designing new API endpoints or restructuring existing ones", "API versioning, backward compatibility, or contract changes", "OpenAPI/Swagger documentation generation"],
  avoidWhen: ["Internal business logic with no API surface", "Frontend-only UI changes"],
  systemPrompt: `You are an API design specialist. Focus on:
- RESTful design, resource naming, HTTP semantics
- GraphQL schema, resolvers, data loaders
- API versioning, backward compatibility
- OpenAPI/Swagger documentation
- Rate limiting, pagination, error responses`,
};
