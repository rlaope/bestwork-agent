import type { Session } from "./types.js";
import { format, startOfDay, subDays } from "date-fns";
import { barChart } from "../utils/format.js";

export interface EffectivenessPoint {
  date: string;
  avgCallsPerPrompt: number;
  totalPrompts: number;
  totalCalls: number;
}

export function calculateEffectiveness(
  sessions: Session[],
  numDays: number = 14
): EffectivenessPoint[] {
  const today = new Date();
  const points: EffectivenessPoint[] = [];

  for (let i = numDays - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const dayStart = startOfDay(date);
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    const daySessions = sessions.filter(
      (s) => s.startedAt >= dayStart && s.startedAt < dayEnd
    );

    const totalPrompts = daySessions.reduce(
      (sum, s) => sum + s.prompts.length,
      0
    );
    const totalCalls = daySessions.reduce(
      (sum, s) => sum + s.totalCalls,
      0
    );
    const avgCallsPerPrompt =
      totalPrompts > 0 ? Math.round(totalCalls / totalPrompts) : 0;

    points.push({
      date: format(date, "MM/dd"),
      avgCallsPerPrompt,
      totalPrompts,
      totalCalls,
    });
  }

  return points;
}

export function renderEffectiveness(points: EffectivenessPoint[]): string {
  const lines: string[] = [];
  const maxCpp = Math.max(...points.map((p) => p.avgCallsPerPrompt), 1);

  lines.push("");
  lines.push("  Prompt Effectiveness — Calls per Prompt (lower = better)");
  lines.push("");
  lines.push(
    "  " +
      "Date".padEnd(8) +
      "Calls/Prompt".padEnd(16) +
      "Chart".padEnd(25) +
      "Prompts"
  );
  lines.push("  " + "─".repeat(58));

  for (const point of points) {
    if (point.totalPrompts === 0) continue;

    const bar = barChart(point.avgCallsPerPrompt, maxCpp, 20);
    const color =
      point.avgCallsPerPrompt <= 10
        ? "\x1b[32m" // green = efficient
        : point.avgCallsPerPrompt <= 20
          ? "\x1b[33m" // yellow = normal
          : "\x1b[31m"; // red = struggling
    const reset = "\x1b[0m";

    lines.push(
      "  " +
        point.date.padEnd(8) +
        `${color}${String(point.avgCallsPerPrompt).padEnd(16)}${reset}` +
        `${bar} `.padEnd(25) +
        String(point.totalPrompts)
    );
  }

  // Trend
  const active = points.filter((p) => p.totalPrompts > 0);
  if (active.length >= 2) {
    const firstHalf = active.slice(0, Math.floor(active.length / 2));
    const secondHalf = active.slice(Math.floor(active.length / 2));

    const avgFirst =
      firstHalf.reduce((s, p) => s + p.avgCallsPerPrompt, 0) /
      firstHalf.length;
    const avgSecond =
      secondHalf.reduce((s, p) => s + p.avgCallsPerPrompt, 0) /
      secondHalf.length;

    const diff = Math.round(((avgSecond - avgFirst) / avgFirst) * 100);
    if (diff < -5) {
      lines.push(
        `\n  \x1b[32m↓ ${Math.abs(diff)}% improvement\x1b[0m — you're getting more efficient`
      );
    } else if (diff > 5) {
      lines.push(
        `\n  \x1b[31m↑ ${diff}% increase\x1b[0m — prompts may need refinement`
      );
    } else {
      lines.push(`\n  \x1b[33m→ Stable\x1b[0m — consistent efficiency`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
