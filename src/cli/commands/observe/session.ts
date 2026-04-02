import { aggregateSessions } from "../../../observe/aggregator.js";
import {
  shortSessionId,
  shortDate,
  barChart,
  formatNumber,
  relativeTime,
} from "../../../utils/format.js";

export async function sessionCommand(id: string) {
  const sessions = await aggregateSessions();
  const session = sessions.find(
    (s) => s.id === id || s.id.startsWith(id)
  );

  if (!session) {
    console.log(`Session not found: ${id}`);
    return;
  }

  const toolEntries = Object.entries(session.toolCounts).sort(
    ([, a], [, b]) => b - a
  );
  const maxCount = toolEntries[0]?.[1] ?? 0;

  console.log(
    `\n  Session ${shortSessionId(session.id)}${session.isActive ? " \x1b[32m● LIVE\x1b[0m" : ""}`
  );
  console.log(
    `  Started: ${shortDate(session.startedAt)} (${relativeTime(session.startedAt)})`
  );
  if (session.meta) {
    console.log(`  CWD: ${session.meta.cwd}`);
  }
  console.log(
    `  Total calls: ${formatNumber(session.totalCalls)} • Prompts: ${formatNumber(session.prompts.length)}`
  );

  console.log(`\n  Tool Usage\n`);
  for (const [tool, count] of toolEntries) {
    const bar = barChart(count, maxCount, 20);
    const pct = ((count / session.totalCalls) * 100).toFixed(1);
    console.log(
      `  ${tool.padEnd(18)} ${bar} ${formatNumber(count).padStart(6)} (${pct}%)`
    );
  }

  if (session.subagents.length > 0) {
    console.log(`\n  Subagents (${session.subagents.length})\n`);
    for (const agent of session.subagents) {
      console.log(`  ├─ ${agent.agentType} — ${agent.description}`);
    }
  }

  if (session.prompts.length > 0) {
    console.log(`\n  Recent Prompts\n`);
    for (const prompt of session.prompts.slice(-5)) {
      const text =
        prompt.display.length > 60
          ? prompt.display.slice(0, 60) + "…"
          : prompt.display;
      console.log(
        `  ${shortDate(new Date(prompt.timestamp))} ${text}`
      );
    }
  }

  console.log();
}
