import { readFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { BestworkEvent, ToolEvent } from "./types.js";

const BESTWORK_DIR = join(homedir(), ".bestwork");
const DATA_DIR = join(BESTWORK_DIR, "data");

export function getBestworkDir(): string {
  return BESTWORK_DIR;
}

export function getDataDir(): string {
  return DATA_DIR;
}

function eventFile(sessionId: string): string {
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return join(DATA_DIR, "unknown.jsonl");
  return join(DATA_DIR, `${safeId}.jsonl`);
}

export async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function appendEvent(event: BestworkEvent): Promise<void> {
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
