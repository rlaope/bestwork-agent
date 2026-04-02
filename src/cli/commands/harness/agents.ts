import { formatAgentCatalog } from "../../../harness/agents.js";

export async function agentsCommand() {
  console.log(formatAgentCatalog());
}
