import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Session } from "./types.js";

export interface SessionOutcome {
  sessionId: string;
  filesModified: string[];
  uniqueFilesRead: number;
  bashCommands: number;
  bashSuccessRate: number;
  agentsSpawned: number;
  promptCount: number;
  callsPerPrompt: number;
  duration: string;
  verdict: "productive" | "normal" | "struggling";
}

export function analyzeOutcome(session: Session): SessionOutcome {
  const filesModified = new Set<string>();
  const filesRead = new Set<string>();

  // Estimate from tool counts
  const editCount = (session.toolCounts["Edit"] ?? 0) + (session.toolCounts["Write"] ?? 0);
  const readCount = session.toolCounts["Read"] ?? 0;
  const bashCount = session.toolCounts["Bash"] ?? 0;

  const durationMs = session.updatedAt.getTime() - session.startedAt.getTime();
  const durationMin = Math.round(durationMs / 60000);

  const callsPerPrompt =
    session.prompts.length > 0
      ? Math.round(session.totalCalls / session.prompts.length)
      : session.totalCalls;

  // Verdict heuristic
  let verdict: "productive" | "normal" | "struggling";
  if (callsPerPrompt <= 10 && session.totalCalls > 5) {
    verdict = "productive";
  } else if (callsPerPrompt > 30) {
    verdict = "struggling";
  } else {
    verdict = "normal";
  }

  return {
    sessionId: session.id,
    filesModified: [], // Would need file-history parsing for exact files
    uniqueFilesRead: readCount,
    bashCommands: bashCount,
    bashSuccessRate: 0, // Needs hooks data
    agentsSpawned: session.subagents.length,
    promptCount: session.prompts.length,
    callsPerPrompt,
    duration: durationMin < 60 ? `${durationMin}m` : `${Math.round(durationMin / 60)}h ${durationMin % 60}m`,
    verdict,
  };
}

export function renderOutcome(outcome: SessionOutcome): string {
  const lines: string[] = [];
  const verdictIcon =
    outcome.verdict === "productive"
      ? "\x1b[32m✓ productive\x1b[0m"
      : outcome.verdict === "struggling"
        ? "\x1b[31m✗ struggling\x1b[0m"
        : "\x1b[33m~ normal\x1b[0m";

  lines.push("");
  lines.push(`  Session Outcome — ${outcome.sessionId.slice(0, 8)}  ${verdictIcon}`);
  lines.push("");
  lines.push(`  Duration:          ${outcome.duration}`);
  lines.push(`  Prompts:           ${outcome.promptCount}`);
  lines.push(`  Calls/Prompt:      ${outcome.callsPerPrompt}`);
  lines.push(`  Files read:        ${outcome.uniqueFilesRead}`);
  lines.push(`  Bash commands:     ${outcome.bashCommands}`);
  lines.push(`  Agents spawned:    ${outcome.agentsSpawned}`);
  lines.push("");

  return lines.join("\n");
}
