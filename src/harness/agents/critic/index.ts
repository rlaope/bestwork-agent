import type { AgentProfile } from "../types.js";
import { perfCriticAgent } from "./perf.js";
import { scaleCriticAgent } from "./scale.js";
import { securityCriticAgent } from "./security.js";
import { consistencyCriticAgent } from "./consistency.js";
import { reliabilityCriticAgent } from "./reliability.js";
import { testingCriticAgent } from "./testing.js";
import { hallucinationCriticAgent } from "./hallucination.js";
import { dxCriticAgent } from "./dx.js";
import { typeCriticAgent } from "./type.js";
import { costCriticAgent } from "./cost.js";
import { devsecopsAgent } from "./devsecops.js";
import { accessibilityCriticAgent } from "./accessibility.js";
import { i18nCriticAgent } from "./i18n.js";
import { agentCriticAgent } from "./agent.js";
import { verifierCriticAgent } from "./verifier.js";

export const CRITIC_AGENTS: AgentProfile[] = [
  perfCriticAgent,
  scaleCriticAgent,
  securityCriticAgent,
  consistencyCriticAgent,
  reliabilityCriticAgent,
  testingCriticAgent,
  hallucinationCriticAgent,
  dxCriticAgent,
  typeCriticAgent,
  costCriticAgent,
  devsecopsAgent,
  accessibilityCriticAgent,
  i18nCriticAgent,
  agentCriticAgent,
  verifierCriticAgent,
];

export {
  perfCriticAgent,
  scaleCriticAgent,
  securityCriticAgent,
  consistencyCriticAgent,
  reliabilityCriticAgent,
  testingCriticAgent,
  hallucinationCriticAgent,
  dxCriticAgent,
  typeCriticAgent,
  costCriticAgent,
  devsecopsAgent,
  accessibilityCriticAgent,
  i18nCriticAgent,
  agentCriticAgent,
  verifierCriticAgent,
};
