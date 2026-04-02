import {
  aggregateSessions,
  getDailySummary,
  getWeeklySummary,
} from "../../../observe/aggregator.js";
import { barChart, formatNumber } from "../../../utils/format.js";

interface SummaryOptions {
  weekly?: boolean;
}

export async function summaryCommand(options: SummaryOptions) {
  const sessions = await aggregateSessions();

  if (options.weekly) {
    printWeeklySummary(sessions);
  } else {
    printDailySummary(sessions);
  }
}

function printDailySummary(sessions: import("../../../types/index.js").Session[]) {
  const summary = getDailySummary(sessions);

  console.log(`\n  nysm — Daily Summary (${summary.date})\n`);
  console.log(`  Sessions:    ${formatNumber(summary.totalSessions)}`);
  console.log(`  Tool calls:  ${formatNumber(summary.totalCalls)}`);
  console.log(`  Prompts:     ${formatNumber(summary.totalPrompts)}`);
  console.log(
    `  Top tool:    ${summary.topTool} (${formatNumber(summary.topToolCount)})`
  );

  if (summary.toolRanking.length > 0) {
    console.log(`\n  Tool Breakdown\n`);
    const maxCount = summary.toolRanking[0]?.count ?? 0;
    for (const tool of summary.toolRanking.slice(0, 10)) {
      const bar = barChart(tool.count, maxCount, 15);
      console.log(
        `  ${tool.name.padEnd(18)} ${bar} ${formatNumber(tool.count).padStart(6)} (${tool.percentage.toFixed(1)}%)`
      );
    }
  }

  console.log();
}

function printWeeklySummary(sessions: import("../../../types/index.js").Session[]) {
  const weekly = getWeeklySummary(sessions);

  console.log(`\n  nysm — Weekly Summary\n`);
  console.log(
    "  " +
      "Date".padEnd(14) +
      "Sessions".padEnd(12) +
      "Calls".padEnd(10) +
      "Top Tool"
  );
  console.log("  " + "─".repeat(50));

  for (const day of weekly) {
    console.log(
      "  " +
        day.date.padEnd(14) +
        formatNumber(day.totalSessions).padEnd(12) +
        formatNumber(day.totalCalls).padEnd(10) +
        day.topTool
    );
  }

  const totalSessions = weekly.reduce((s, d) => s + d.totalSessions, 0);
  const totalCalls = weekly.reduce((s, d) => s + d.totalCalls, 0);
  console.log("  " + "─".repeat(50));
  console.log(
    "  " +
      "Total".padEnd(14) +
      formatNumber(totalSessions).padEnd(12) +
      formatNumber(totalCalls)
  );
  console.log();
}
