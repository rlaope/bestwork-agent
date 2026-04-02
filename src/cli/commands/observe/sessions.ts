import { aggregateSessions } from "../../../observe/aggregator.js";
import {
  shortSessionId,
  relativeTime,
  formatNumber,
  truncate,
} from "../../../utils/format.js";

interface SessionsOptions {
  limit: string;
}

export async function sessionsCommand(options: SessionsOptions) {
  const sessions = await aggregateSessions();
  const limit = parseInt(options.limit, 10) || 10;
  const display = sessions.slice(0, limit);

  if (display.length === 0) {
    console.log("No sessions found.");
    return;
  }

  const totalCalls = sessions.reduce((sum, s) => sum + s.totalCalls, 0);
  console.log(`\n  Sessions (${sessions.length} total, ${formatNumber(totalCalls)} calls)\n`);

  for (const s of display) {
    const status = s.isActive ? "\x1b[32m●\x1b[0m" : "\x1b[90m○\x1b[0m";
    const cwd = s.meta?.cwd ?? "";
    const cwdShort = cwd ? cwd.split("/").slice(-2).join("/") : "";
    const lastPrompt = s.prompts[s.prompts.length - 1];
    const promptText = lastPrompt ? truncate(lastPrompt.display, 40) : "";
    const pct = totalCalls > 0 ? ((s.totalCalls / totalCalls) * 100).toFixed(1) : "0";

    let line =
      "  " +
      shortSessionId(s.id) + " " +
      status + " " +
      formatNumber(s.totalCalls).padStart(4) + " " +
      `\x1b[35m${pct.padStart(5)}%\x1b[0m ` +
      relativeTime(s.startedAt).padEnd(18);

    if (cwdShort) line += ` \x1b[34m${cwdShort}\x1b[0m`;
    if (promptText) line += ` \x1b[90m💬 ${promptText}\x1b[0m`;

    console.log(line);
  }
  console.log();
}
