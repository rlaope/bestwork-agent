import type { ToolEvent } from "../data/types.js";
import { shortDate, barChart } from "../utils/format.js";

export interface ReplayStep {
  index: number;
  timestamp: Date;
  tool: string;
  target: string;
  event: string;
  elapsed: string;
  icon: string;
}

const TOOL_ICONS: Record<string, string> = {
  Read: "📖",
  Write: "✏️",
  Edit: "🔧",
  Bash: "⚡",
  Glob: "🔍",
  Grep: "🔎",
  Agent: "🤖",
  TaskCreate: "📋",
  TaskUpdate: "✅",
  WebSearch: "🌐",
  WebFetch: "🌐",
};

export function buildReplay(events: ToolEvent[]): ReplayStep[] {
  const sorted = events
    .filter((e) => e.event === "post" || e.event === "pre")
    .sort((a, b) => a.timestamp - b.timestamp);

  const steps: ReplayStep[] = [];
  let prevTs = sorted[0]?.timestamp ?? 0;

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i]!;
    const elapsed = event.timestamp - prevTs;
    prevTs = event.timestamp;

    steps.push({
      index: i + 1,
      timestamp: new Date(event.timestamp),
      tool: event.toolName,
      target: getTarget(event),
      event: event.event,
      elapsed: formatElapsed(elapsed),
      icon: TOOL_ICONS[event.toolName] ?? "•",
    });
  }

  return steps;
}

export function renderReplay(steps: ReplayStep[], sessionId: string): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(`  Session Replay — ${sessionId.slice(0, 8)}`);
  lines.push(`  ${steps.length} steps`);
  lines.push("");

  // Tool frequency summary
  const toolCounts = new Map<string, number>();
  for (const step of steps) {
    toolCounts.set(step.tool, (toolCounts.get(step.tool) ?? 0) + 1);
  }
  const maxCount = Math.max(...toolCounts.values());

  lines.push("  Tool Summary");
  for (const [tool, count] of [...toolCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    const bar = barChart(count, maxCount, 12);
    const icon = TOOL_ICONS[tool] ?? "•";
    lines.push(
      `  ${icon} ${tool.padEnd(16)} ${bar} ${String(count).padStart(4)}`
    );
  }
  lines.push("");

  // Timeline
  lines.push("  Timeline");
  lines.push("  ─".padEnd(76, "─"));

  for (const step of steps) {
    const timeStr = shortDate(step.timestamp);
    const elapsedStr =
      step.index === 1 ? "      " : `+${step.elapsed.padEnd(5)}`;

    const targetShort =
      step.target.length > 35
        ? "…" + step.target.slice(-34)
        : step.target;

    const eventTag =
      step.event === "fail" ? " \x1b[31mFAIL\x1b[0m" : "";

    lines.push(
      `  ${String(step.index).padStart(4)}  ${timeStr}  ${elapsedStr}  ${step.icon} ${step.tool.padEnd(14)} ${targetShort}${eventTag}`
    );
  }

  lines.push("");
  return lines.join("\n");
}

function getTarget(event: ToolEvent): string {
  if (event.input?.file_path) return event.input.file_path;
  if (event.output?.filePath) return event.output.filePath;
  if (event.input?.command) {
    const cmd = event.input.command;
    return cmd.length > 40 ? cmd.slice(0, 40) + "…" : cmd;
  }
  if (event.input?.pattern) return `pattern: ${event.input.pattern}`;
  return "";
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
