import { format, subDays, startOfDay, getDay } from "date-fns";
import type { Session } from "./types.js";

export interface HeatmapDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapData {
  days: HeatmapDay[];
  maxCount: number;
  totalSessions: number;
  totalDays: number;
  activeDays: number;
  streak: number;
}

export function buildHeatmap(
  sessions: Session[],
  numDays: number = 365
): HeatmapData {
  const today = startOfDay(new Date());

  // Count sessions per day
  const countMap = new Map<string, number>();
  for (const session of sessions) {
    const dayKey = format(startOfDay(session.startedAt), "yyyy-MM-dd");
    countMap.set(dayKey, (countMap.get(dayKey) ?? 0) + 1);
  }

  // Build day array
  const days: HeatmapDay[] = [];
  let maxCount = 0;

  for (let i = numDays - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const count = countMap.get(dateStr) ?? 0;
    if (count > maxCount) maxCount = count;
    days.push({ date: dateStr, count, level: 0 });
  }

  // Assign levels (quartiles)
  if (maxCount > 0) {
    for (const day of days) {
      if (day.count === 0) day.level = 0;
      else if (day.count <= maxCount * 0.25) day.level = 1;
      else if (day.count <= maxCount * 0.5) day.level = 2;
      else if (day.count <= maxCount * 0.75) day.level = 3;
      else day.level = 4;
    }
  }

  // Calculate streak
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i]!.count > 0) streak++;
    else break;
  }

  const activeDays = days.filter((d) => d.count > 0).length;

  return {
    days,
    maxCount,
    totalSessions: sessions.length,
    totalDays: numDays,
    activeDays,
    streak,
  };
}

const BLOCKS = ["░", "▒", "▓", "█", "█"] as const;
const COLORS = ["\x1b[90m", "\x1b[32m", "\x1b[32m", "\x1b[92m", "\x1b[92m"] as const;
const RESET = "\x1b[0m";

export function renderHeatmap(data: HeatmapData): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("  nysm — Activity Heatmap");
  lines.push("");

  // Build grid: 7 rows (Sun-Sat) x N weeks
  const grid: HeatmapDay[][] = [[], [], [], [], [], [], []];

  // Pad start to align with day of week
  const firstDate = new Date(data.days[0]!.date);
  const firstDow = getDay(firstDate); // 0=Sun
  for (let i = 0; i < firstDow; i++) {
    grid[i]!.push({ date: "", count: 0, level: 0 });
  }

  for (const day of data.days) {
    const dow = getDay(new Date(day.date));
    grid[dow]!.push(day);
  }

  // Month labels
  const monthRow = "  " + " ".repeat(6);
  const months: string[] = [];
  let lastMonth = "";
  for (let w = 0; w < (grid[0]?.length ?? 0); w++) {
    // Find a day in this week
    let dayInWeek: HeatmapDay | undefined;
    for (let d = 0; d < 7; d++) {
      const cell = grid[d]?.[w];
      if (cell && cell.date) {
        dayInWeek = cell;
        break;
      }
    }
    if (dayInWeek && dayInWeek.date) {
      const m = dayInWeek.date.slice(5, 7);
      const monthNames: Record<string, string> = {
        "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
        "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
        "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
      };
      if (m !== lastMonth) {
        months.push(monthNames[m] ?? "");
        lastMonth = m;
      } else {
        months.push("  ");
      }
    } else {
      months.push("  ");
    }
  }
  lines.push(monthRow + months.join(""));

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let d = 0; d < 7; d++) {
    const label = d % 2 === 1 ? dayLabels[d]! : "   ";
    let row = `  ${label}  `;

    for (const cell of grid[d] ?? []) {
      if (!cell.date) {
        row += "  ";
      } else {
        const color = COLORS[cell.level]!;
        const block = BLOCKS[cell.level]!;
        row += `${color}${block}${RESET} `;
      }
    }

    lines.push(row);
  }

  lines.push("");
  lines.push(
    `  ${data.totalSessions} sessions · ${data.activeDays} active days · ${data.streak} day streak`
  );
  lines.push(
    `  ${COLORS[0]}░${RESET} none  ${COLORS[1]}▒${RESET} low  ${COLORS[2]}▓${RESET} med  ${COLORS[3]}█${RESET} high`
  );
  lines.push("");

  return lines.join("\n");
}
