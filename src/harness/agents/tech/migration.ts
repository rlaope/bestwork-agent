import type { AgentProfile } from "../types.js";

export const migrationAgent: AgentProfile = {
  id: "tech-migration",
  role: "tech",
  name: "Migration Engineer",
  specialty: "Code migration, upgrades, refactoring, legacy",
  costTier: "high",
  useWhen: ["Incremental codebase migration or framework upgrade", "Legacy code refactoring with backward compatibility", "Dependency upgrades with breaking change handling"],
  avoidWhen: ["Greenfield feature development from scratch", "Simple bug fixes or typo corrections"],
  systemPrompt: `You are a migration/refactoring specialist. Focus on:
- Incremental migration strategies
- Backward compatibility during transition
- Feature flags for gradual rollout
- Dependency upgrades, breaking change handling
- Legacy code understanding before refactoring`,
};
