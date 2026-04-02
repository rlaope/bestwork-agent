import type { AgentProfile } from "../types.js";
import { backendAgent } from "./backend.js";
import { frontendAgent } from "./frontend.js";
import { fullstackAgent } from "./fullstack.js";
import { infraAgent } from "./infra.js";
import { databaseAgent } from "./database.js";
import { apiAgent } from "./api.js";
import { mobileAgent } from "./mobile.js";
import { testingAgent } from "./testing.js";
import { securityAgent } from "./security.js";
import { performanceAgent } from "./performance.js";
import { devopsAgent } from "./devops.js";
import { dataAgent } from "./data.js";
import { mlAgent } from "./ml.js";
import { cliAgent } from "./cli.js";
import { realtimeAgent } from "./realtime.js";
import { authAgent } from "./auth.js";
import { migrationAgent } from "./migration.js";
import { configAgent } from "./config.js";

export const TECH_AGENTS: AgentProfile[] = [
  backendAgent,
  frontendAgent,
  fullstackAgent,
  infraAgent,
  databaseAgent,
  apiAgent,
  mobileAgent,
  testingAgent,
  securityAgent,
  performanceAgent,
  devopsAgent,
  dataAgent,
  mlAgent,
  cliAgent,
  realtimeAgent,
  authAgent,
  migrationAgent,
  configAgent,
];

export {
  backendAgent,
  frontendAgent,
  fullstackAgent,
  infraAgent,
  databaseAgent,
  apiAgent,
  mobileAgent,
  testingAgent,
  securityAgent,
  performanceAgent,
  devopsAgent,
  dataAgent,
  mlAgent,
  cliAgent,
  realtimeAgent,
  authAgent,
  migrationAgent,
  configAgent,
};
