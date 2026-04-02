/**
 * Meeting Log — real-time visualization of agent decisions
 *
 * Shows what each agent said, decided, and produced during team execution.
 * Renders to terminal AND can be sent to Discord/Slack.
 */

export type Decision = "APPROVE" | "REQUEST_CHANGES" | "COMMENT" | "IMPLEMENT";

export interface MeetingEntry {
  timestamp: Date;
  agentId: string;
  title: string;
  level: string;
  phase: "implement" | "review" | "approve" | "discuss";
  decision: Decision;
  summary: string;
  details?: string;
  codeSnippet?: string;
  filesChanged?: string[];
  iteration: number;
}

export interface MeetingLog {
  teamName: string;
  mode: string;
  task: string;
  startedAt: Date;
  entries: MeetingEntry[];
  finalVerdict: "APPROVED" | "REJECTED" | "IN_PROGRESS";
  totalIterations: number;
  routingReason: string;
  classification: string;
  developerCount: number;
}

// ============================================================
// Terminal Rendering
// ============================================================

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
};

const LEVEL_COLORS: Record<string, string> = {
  "c-level": COLORS.magenta,
  "lead": COLORS.cyan,
  "senior": COLORS.blue,
  "junior": COLORS.green,
};

const DECISION_ICONS: Record<Decision, string> = {
  APPROVE: `${COLORS.green}✓ APPROVE${COLORS.reset}`,
  REQUEST_CHANGES: `${COLORS.yellow}↻ REQUEST_CHANGES${COLORS.reset}`,
  COMMENT: `${COLORS.cyan}💬 COMMENT${COLORS.reset}`,
  IMPLEMENT: `${COLORS.blue}🔨 IMPLEMENT${COLORS.reset}`,
};

const PHASE_ICONS: Record<string, string> = {
  implement: "🔨",
  review: "🔍",
  approve: "✅",
  discuss: "💬",
};

export function renderMeetingHeader(log: MeetingLog): string {
  const lines: string[] = [];
  const modeTag = log.mode === "hierarchy" ? "⬆ Hierarchy" : log.mode === "squad" ? "◆ Squad" : log.mode === "review" ? "📋 Review" : "💡 Advisory";

  lines.push("");
  lines.push(`${COLORS.bold}┌─────────────────────────────────────────────────────────┐${COLORS.reset}`);
  lines.push(`${COLORS.bold}│${COLORS.reset}  ${COLORS.cyan}${COLORS.bold}bestwork meeting${COLORS.reset} — ${modeTag}                            ${COLORS.bold}│${COLORS.reset}`);
  lines.push(`${COLORS.bold}│${COLORS.reset}  Team: ${log.teamName.padEnd(48)}${COLORS.bold}│${COLORS.reset}`);
  lines.push(`${COLORS.bold}│${COLORS.reset}  Task: ${log.task.slice(0, 48).padEnd(48)}${COLORS.bold}│${COLORS.reset}`);
  lines.push(`${COLORS.bold}│${COLORS.reset}  Type: ${log.classification.padEnd(48)}${COLORS.bold}│${COLORS.reset}`);
  lines.push(`${COLORS.bold}│${COLORS.reset}  Devs: ${String(log.developerCount).padEnd(48)}${COLORS.bold}│${COLORS.reset}`);
  lines.push(`${COLORS.bold}│${COLORS.reset}  Why:  ${log.routingReason.slice(0, 48).padEnd(48)}${COLORS.bold}│${COLORS.reset}`);
  lines.push(`${COLORS.bold}└─────────────────────────────────────────────────────────┘${COLORS.reset}`);
  lines.push("");

  return lines.join("\n");
}

export function renderMeetingEntry(entry: MeetingEntry, showDetails: boolean = true): string {
  const lines: string[] = [];
  const color = LEVEL_COLORS[entry.level] ?? COLORS.white;
  const time = entry.timestamp.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const phaseIcon = PHASE_ICONS[entry.phase] ?? "•";
  const decisionIcon = DECISION_ICONS[entry.decision] ?? entry.decision;

  // Agent header
  lines.push(`${COLORS.gray}${time}${COLORS.reset} ${phaseIcon} ${color}${COLORS.bold}${entry.title}${COLORS.reset} ${COLORS.dim}(${entry.agentId})${COLORS.reset}`);

  // Decision
  lines.push(`       ${decisionIcon}`);

  // Summary
  lines.push(`       ${entry.summary}`);

  // Details (if available and requested)
  if (showDetails && entry.details) {
    const detailLines = entry.details.split("\n").slice(0, 5);
    for (const line of detailLines) {
      lines.push(`       ${COLORS.gray}│ ${line}${COLORS.reset}`);
    }
  }

  // Code snippet
  if (entry.codeSnippet) {
    lines.push(`       ${COLORS.dim}┌── code ──${COLORS.reset}`);
    for (const line of entry.codeSnippet.split("\n").slice(0, 6)) {
      lines.push(`       ${COLORS.dim}│ ${line}${COLORS.reset}`);
    }
    lines.push(`       ${COLORS.dim}└──────────${COLORS.reset}`);
  }

  // Files changed
  if (entry.filesChanged && entry.filesChanged.length > 0) {
    const fileList = entry.filesChanged.slice(0, 3).join(", ");
    const more = entry.filesChanged.length > 3 ? ` +${entry.filesChanged.length - 3} more` : "";
    lines.push(`       ${COLORS.dim}📁 ${fileList}${more}${COLORS.reset}`);
  }

  // Iteration marker
  if (entry.iteration > 1) {
    lines.push(`       ${COLORS.yellow}↻ iteration ${entry.iteration}${COLORS.reset}`);
  }

  lines.push("");
  return lines.join("\n");
}

export function renderMeetingFooter(log: MeetingLog): string {
  const lines: string[] = [];
  const duration = Math.round((Date.now() - log.startedAt.getTime()) / 1000);
  const durationStr = duration < 60 ? `${duration}s` : `${Math.floor(duration / 60)}m ${duration % 60}s`;

  const approveCount = log.entries.filter((e) => e.decision === "APPROVE").length;
  const rejectCount = log.entries.filter((e) => e.decision === "REQUEST_CHANGES").length;
  const implementCount = log.entries.filter((e) => e.decision === "IMPLEMENT").length;

  const verdictColor = log.finalVerdict === "APPROVED" ? COLORS.green : log.finalVerdict === "REJECTED" ? COLORS.red : COLORS.yellow;

  lines.push(`${COLORS.bold}┌─────────────────────────────────────────────────────────┐${COLORS.reset}`);
  lines.push(`${COLORS.bold}│${COLORS.reset}  ${COLORS.bold}Meeting Summary${COLORS.reset}                                       ${COLORS.bold}│${COLORS.reset}`);
  lines.push(`${COLORS.bold}│${COLORS.reset}                                                         ${COLORS.bold}│${COLORS.reset}`);
  lines.push(`${COLORS.bold}│${COLORS.reset}  Verdict: ${verdictColor}${COLORS.bold}${log.finalVerdict}${COLORS.reset}                                      ${COLORS.bold}│${COLORS.reset}`);
  lines.push(`${COLORS.bold}│${COLORS.reset}  Duration: ${durationStr.padEnd(46)}${COLORS.bold}│${COLORS.reset}`);
  lines.push(`${COLORS.bold}│${COLORS.reset}  Iterations: ${String(log.totalIterations).padEnd(43)}${COLORS.bold}│${COLORS.reset}`);
  lines.push(`${COLORS.bold}│${COLORS.reset}  Decisions: ${COLORS.green}${approveCount} approve${COLORS.reset} · ${COLORS.yellow}${rejectCount} changes${COLORS.reset} · ${COLORS.blue}${implementCount} implement${COLORS.reset}    ${COLORS.bold}│${COLORS.reset}`);
  lines.push(`${COLORS.bold}└─────────────────────────────────────────────────────────┘${COLORS.reset}`);
  lines.push("");

  return lines.join("\n");
}

export function renderFullMeeting(log: MeetingLog): string {
  let output = renderMeetingHeader(log);

  for (const entry of log.entries) {
    output += renderMeetingEntry(entry);
  }

  output += renderMeetingFooter(log);
  return output;
}

// ============================================================
// Discord/Slack formatting
// ============================================================

export function formatMeetingForDiscord(log: MeetingLog): object {
  const approveCount = log.entries.filter((e) => e.decision === "APPROVE").length;
  const rejectCount = log.entries.filter((e) => e.decision === "REQUEST_CHANGES").length;
  const duration = Math.round((Date.now() - log.startedAt.getTime()) / 1000);

  const agentSummaries = log.entries
    .map((e) => {
      let text = `**${e.title}** → ${e.decision}\n${e.summary}`;
      if (e.codeSnippet) {
        const snippet = e.codeSnippet.split("\n").slice(0, 4).join("\n");
        text += `\n\`\`\`\n${snippet}\n\`\`\``;
      }
      if (e.filesChanged && e.filesChanged.length > 0) {
        text += `\n📁 ${e.filesChanged.slice(0, 3).join(", ")}`;
      }
      return text;
    })
    .join("\n\n");

  const color = log.finalVerdict === "APPROVED" ? 0x00d4aa : log.finalVerdict === "REJECTED" ? 0xff4444 : 0xffaa00;

  return {
    embeds: [
      {
        title: `${log.mode === "hierarchy" ? "⬆" : "◆"} ${log.teamName} — ${log.finalVerdict}`,
        description: `**Task:** ${log.task}\n**Type:** ${log.classification} · **Devs:** ${log.developerCount}\n**Why this team:** ${log.routingReason}\n**Duration:** ${duration}s · **Iterations:** ${log.totalIterations}\n**Decisions:** ${approveCount} approve · ${rejectCount} changes\n\n${agentSummaries}`,
        color,
        footer: { text: "bestwork-agent" },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function formatMeetingForSlack(log: MeetingLog): object {
  const approveCount = log.entries.filter((e) => e.decision === "APPROVE").length;
  const rejectCount = log.entries.filter((e) => e.decision === "REQUEST_CHANGES").length;
  const duration = Math.round((Date.now() - log.startedAt.getTime()) / 1000);

  const agentSummaries = log.entries
    .map((e) => {
      let text = `*${e.title}* → ${e.decision}\n${e.summary}`;
      if (e.codeSnippet) {
        text += `\n\`\`\`${e.codeSnippet.split("\n").slice(0, 4).join("\n")}\`\`\``;
      }
      return text;
    })
    .join("\n\n");

  return {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${log.mode === "hierarchy" ? "⬆" : "◆"} ${log.teamName} — ${log.finalVerdict}` },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Task:* ${log.task}\n*Type:* ${log.classification} · *Devs:* ${log.developerCount}\n*Why:* ${log.routingReason}\n*Duration:* ${duration}s · *Iterations:* ${log.totalIterations}\n*Decisions:* ${approveCount} approve · ${rejectCount} changes\n\n${agentSummaries}`,
        },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: "bestwork-agent" }],
      },
    ],
  };
}
