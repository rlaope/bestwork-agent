import type { Session } from "../types/index.js";
import { getToolRanking } from "./aggregator.js";
import { buildHeatmap } from "./heatmap.js";
import { format } from "date-fns";

export function renderStatsCard(sessions: Session[]): string {
  const heatmap = buildHeatmap(sessions, 30);
  const ranking = getToolRanking(sessions);
  const totalCalls = sessions.reduce((s, sess) => s + sess.totalCalls, 0);
  const totalPrompts = sessions.reduce((s, sess) => s + sess.prompts.length, 0);
  const avgCallsPerSession =
    sessions.length > 0 ? Math.round(totalCalls / sessions.length) : 0;

  const topTools = ranking.slice(0, 3);

  const today = format(new Date(), "yyyy-MM-dd");

  // Mini heatmap (last 30 days)
  const BLOCKS = ["░", "▒", "▓", "█"];
  const miniHeatmap = heatmap.days
    .slice(-30)
    .map((d) => BLOCKS[d.level] ?? "░")
    .join("");

  const lines: string[] = [];
  lines.push("┌──────────────────────────────────────────────┐");
  lines.push("│         \x1b[1m\x1b[36mnysm\x1b[0m — now you see me              │");
  lines.push("│                                              │");
  lines.push(`│  ${today}                                │`);
  lines.push("│                                              │");
  lines.push(`│  Sessions:  ${String(sessions.length).padEnd(6)} Calls: ${String(totalCalls).padEnd(10)}│`);
  lines.push(`│  Prompts:   ${String(totalPrompts).padEnd(6)} Avg/Session: ${String(avgCallsPerSession).padEnd(5)}│`);
  lines.push(`│  Streak:    ${String(heatmap.streak).padEnd(6)} Active Days: ${String(heatmap.activeDays).padEnd(5)}│`);
  lines.push("│                                              │");
  lines.push(`│  Top Tools:                                  │`);
  for (const tool of topTools) {
    const pct = `${tool.percentage.toFixed(0)}%`;
    lines.push(`│    ${tool.name.padEnd(16)} ${pct.padEnd(6)} (${String(tool.count).padEnd(4)}) │`);
  }
  lines.push("│                                              │");
  lines.push(`│  ${miniHeatmap}  │`);
  lines.push("│                                              │");
  lines.push("│  github.com/rlaope/nysm                      │");
  lines.push("└──────────────────────────────────────────────┘");

  return "\n" + lines.join("\n") + "\n";
}
