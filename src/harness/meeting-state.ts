/**
 * Meeting State — persists agent decisions to disk during trio/team/squad execution.
 *
 * Smart gateway agent writes entries here as agents complete.
 * Stop hook reads entries and includes them in Discord/Slack notifications.
 *
 * File: ~/.bestwork/state/meeting.jsonl (one JSON per line)
 */

import { readFile, appendFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const STATE_DIR = join(homedir(), ".bestwork", "state");
const MEETING_FILE = join(STATE_DIR, "meeting.jsonl");

export interface MeetingEntry {
  timestamp: string;
  agentId: string;
  title: string;
  role: string;
  phase: "implement" | "review" | "approve";
  decision: "APPROVE" | "REQUEST_CHANGES" | "IMPLEMENT" | "COMMENT";
  summary: string;
  filesChanged?: string[];
  codeSnippet?: string;
  iteration: number;
}

export interface MeetingSummary {
  teamName: string;
  mode: string;
  task: string;
  classification: string;
  developerCount: number;
  routingReason: string;
  entries: MeetingEntry[];
  verdict: "APPROVED" | "REJECTED" | "IN_PROGRESS";
  totalIterations: number;
}

export async function startMeeting(
  teamName: string,
  mode: string,
  task: string,
  classification: string,
  developerCount: number,
  routingReason: string
): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  const header: MeetingSummary = {
    teamName,
    mode,
    task,
    classification,
    developerCount,
    routingReason,
    entries: [],
    verdict: "IN_PROGRESS",
    totalIterations: 0,
  };
  await writeFile(MEETING_FILE, JSON.stringify({ type: "header", ...header }) + "\n");
}

export async function addEntry(entry: MeetingEntry): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  await appendFile(MEETING_FILE, JSON.stringify({ type: "entry", ...entry }) + "\n");
}

export async function finishMeeting(verdict: "APPROVED" | "REJECTED", totalIterations: number): Promise<void> {
  await appendFile(MEETING_FILE, JSON.stringify({ type: "footer", verdict, totalIterations }) + "\n");
}

export async function readMeeting(): Promise<MeetingSummary | null> {
  try {
    const raw = await readFile(MEETING_FILE, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return null;

    let summary: MeetingSummary | null = null;
    const entries: MeetingEntry[] = [];

    for (const line of lines) {
      const obj = JSON.parse(line);
      if (obj.type === "header") {
        summary = {
          teamName: obj.teamName,
          mode: obj.mode,
          task: obj.task,
          classification: obj.classification,
          developerCount: obj.developerCount,
          routingReason: obj.routingReason,
          entries: [],
          verdict: "IN_PROGRESS",
          totalIterations: 0,
        };
      } else if (obj.type === "entry") {
        entries.push(obj as MeetingEntry);
      } else if (obj.type === "footer") {
        if (summary) {
          summary.verdict = obj.verdict;
          summary.totalIterations = obj.totalIterations;
        }
      }
    }

    if (summary) {
      summary.entries = entries;
    }
    return summary;
  } catch {
    return null;
  }
}

export async function clearMeeting(): Promise<void> {
  try {
    await writeFile(MEETING_FILE, "");
  } catch {}
}

/**
 * Format meeting for Discord embed description
 */
export function formatMeetingForNotification(meeting: MeetingSummary): string {
  let desc = "";
  desc += `**Team:** ${meeting.teamName} (${meeting.mode})\n`;
  desc += `**Task:** ${meeting.task}\n`;
  desc += `**Type:** ${meeting.classification} · **Devs:** ${meeting.developerCount}\n`;
  desc += `**Why:** ${meeting.routingReason}\n\n`;

  for (const entry of meeting.entries) {
    const icon =
      entry.decision === "APPROVE" ? "✅" :
      entry.decision === "REQUEST_CHANGES" ? "🔄" :
      entry.decision === "IMPLEMENT" ? "🔨" : "💬";

    desc += `${icon} **${entry.title}** → ${entry.decision}\n`;
    desc += `${entry.summary}\n`;

    if (entry.codeSnippet) {
      const snippet = entry.codeSnippet.split("\n").slice(0, 4).join("\n");
      desc += `\`\`\`ts\n${snippet}\n\`\`\`\n`;
    }

    if (entry.filesChanged && entry.filesChanged.length > 0) {
      desc += `📁 ${entry.filesChanged.slice(0, 3).join(", ")}\n`;
    }
    desc += "\n";
  }

  const approveCount = meeting.entries.filter((e) => e.decision === "APPROVE").length;
  const changesCount = meeting.entries.filter((e) => e.decision === "REQUEST_CHANGES").length;

  desc += `**Verdict:** ${meeting.verdict}\n`;
  desc += `**Decisions:** ${approveCount} approve · ${changesCount} changes · ${meeting.totalIterations} iterations`;

  return desc;
}
