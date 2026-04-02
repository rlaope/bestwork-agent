import { readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type {
  RawSessionStats,
  RawSessionStat,
  HistoryEntry,
  SessionMeta,
  SubagentMeta,
} from "../types/index.js";

const CLAUDE_DIR = join(homedir(), ".claude");

export function getClaudeDir(): string {
  return CLAUDE_DIR;
}

export async function parseSessionStats(): Promise<
  Map<string, RawSessionStat>
> {
  try {
    const raw = await readFile(
      join(CLAUDE_DIR, ".session-stats.json"),
      "utf-8"
    );
    const data: RawSessionStats = JSON.parse(raw);
    return new Map(Object.entries(data.sessions ?? {}));
  } catch {
    return new Map();
  }
}

export async function parseHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await readFile(join(CLAUDE_DIR, "history.jsonl"), "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines.map((line: string) => JSON.parse(line) as HistoryEntry);
  } catch {
    return [];
  }
}

export async function parseSessions(): Promise<SessionMeta[]> {
  const sessionsDir = join(CLAUDE_DIR, "sessions");
  try {
    const files = await readdir(sessionsDir);
    const jsonFiles = files.filter((f: string) => f.endsWith(".json"));

    const results = await Promise.allSettled(
      jsonFiles.map(async (file: string) => {
        const raw = await readFile(join(sessionsDir, file), "utf-8");
        return JSON.parse(raw) as SessionMeta;
      })
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<SessionMeta> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value);
  } catch {
    return [];
  }
}

export async function parseSubagents(): Promise<SubagentMeta[]> {
  const projectsDir = join(CLAUDE_DIR, "projects");
  const subagents: SubagentMeta[] = [];

  try {
    const projectDirs = await readdir(projectsDir);

    for (const projectDir of projectDirs) {
      const projectPath = join(projectsDir, projectDir);
      let sessionDirs: string[];
      try {
        sessionDirs = await readdir(projectPath);
      } catch {
        continue;
      }

      for (const sessionDir of sessionDirs) {
        const subagentsDir = join(projectPath, sessionDir, "subagents");
        let agentFiles: string[];
        try {
          agentFiles = await readdir(subagentsDir);
        } catch {
          continue;
        }

        const metaFiles = agentFiles.filter((f: string) => f.endsWith(".meta.json"));
        for (const metaFile of metaFiles) {
          try {
            const raw = await readFile(join(subagentsDir, metaFile), "utf-8");
            const meta = JSON.parse(raw);
            subagents.push({
              ...meta,
              sessionId: sessionDir,
              agentId: basename(metaFile, ".meta.json"),
            });
          } catch {
            continue;
          }
        }
      }
    }
  } catch {
    // projects dir doesn't exist
  }

  return subagents;
}
