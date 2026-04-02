import { formatAgentCatalog } from "../../../harness/agents/index.js";

export async function agentsCommand() {
  console.log(formatAgentCatalog());
}
