import { appendFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import * as os from "node:os";
import type { AgentRun } from "../types/index.js";

function agentsDir(): string {
  return join(os.homedir(), ".bestwork", "agents");
}

function runsFile(): string {
  return join(agentsDir(), "runs.jsonl");
}

export async function saveAgentRun(run: AgentRun): Promise<void> {
  const dir = agentsDir();
  await mkdir(dir, { recursive: true });
  await appendFile(runsFile(), JSON.stringify(run) + "\n", "utf8");
}

export async function loadAgentRuns(agentName?: string): Promise<AgentRun[]> {
  let raw: string;
  try {
    raw = await readFile(runsFile(), "utf8");
  } catch {
    return [];
  }

  const runs: AgentRun[] = raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AgentRun);

  if (agentName !== undefined) {
    return runs.filter((r) => r.agent === agentName);
  }
  return runs;
}
