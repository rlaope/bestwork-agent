import { readFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { NysmEvent, ToolEvent } from "./types.js";

const NYSM_DIR = join(homedir(), ".nysm");
const DATA_DIR = join(NYSM_DIR, "data");

export function getNysmDir(): string {
  return NYSM_DIR;
}

export function getDataDir(): string {
  return DATA_DIR;
}

function eventFile(sessionId: string): string {
  return join(DATA_DIR, `${sessionId}.jsonl`);
}

export async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function appendEvent(event: NysmEvent): Promise<void> {
  await ensureDataDir();
  const sessionId =
    "sessionId" in event ? event.sessionId : "unknown";
  const line = JSON.stringify(event) + "\n";
  await appendFile(eventFile(sessionId), line);
}

export async function readSessionEvents(
  sessionId: string
): Promise<ToolEvent[]> {
  try {
    const raw = await readFile(eventFile(sessionId), "utf-8");
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line: string) => JSON.parse(line) as ToolEvent);
  } catch {
    return [];
  }
}

export async function readAllEvents(): Promise<ToolEvent[]> {
  const { readdir } = await import("node:fs/promises");
  try {
    const files = await readdir(DATA_DIR);
    const jsonlFiles = files.filter((f: string) => f.endsWith(".jsonl"));

    const allEvents: ToolEvent[] = [];
    for (const file of jsonlFiles) {
      try {
        const raw = await readFile(join(DATA_DIR, file), "utf-8");
        const events = raw
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line: string) => JSON.parse(line) as ToolEvent);
        allEvents.push(...events);
      } catch {
        continue;
      }
    }

    return allEvents.sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}
