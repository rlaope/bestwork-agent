import type { AgentProfile } from "../types.js";
import { productAgent } from "./product.js";
import { apiPmAgent } from "./api.js";
import { platformAgent } from "./platform.js";
import { dataPmAgent } from "./data.js";
import { infraPmAgent } from "./infra.js";
import { migrationPmAgent } from "./migration.js";
import { securityPmAgent } from "./security.js";
import { growthAgent } from "./growth.js";
import { dxPmAgent } from "./dx.js";
import { compliancePmAgent } from "./compliance.js";

export const PM_AGENTS: AgentProfile[] = [
  productAgent,
  apiPmAgent,
  platformAgent,
  dataPmAgent,
  infraPmAgent,
  migrationPmAgent,
  securityPmAgent,
  growthAgent,
  dxPmAgent,
  compliancePmAgent,
];

export {
  productAgent,
  apiPmAgent,
  platformAgent,
  dataPmAgent,
  infraPmAgent,
  migrationPmAgent,
  securityPmAgent,
  growthAgent,
  dxPmAgent,
  compliancePmAgent,
};
