import { appendFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import * as os from "node:os";
import type { AllocationOutcome } from "../types/index.js";

function optimizationDir(): string {
  return join(os.homedir(), ".bestwork", "optimization");
}

function allocationsFile(): string {
  return join(optimizationDir(), "allocations.jsonl");
}

export async function saveAllocation(entry: AllocationOutcome): Promise<void> {
  const dir = optimizationDir();
  await mkdir(dir, { recursive: true });
  await appendFile(allocationsFile(), JSON.stringify(entry) + "\n", "utf8");
}

export async function loadAllocations(domain?: string): Promise<AllocationOutcome[]> {
  let raw: string;
  try {
    raw = await readFile(allocationsFile(), "utf8");
  } catch {
    return [];
  }

  const entries: AllocationOutcome[] = raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AllocationOutcome);

  if (domain !== undefined) {
    return entries.filter((e) => e.domain === domain);
  }
  return entries;
}
