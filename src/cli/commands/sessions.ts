import { aggregateSessions } from "../../core/aggregator.js";
import {
  shortSessionId,
  relativeTime,
  formatNumber,
} from "../../utils/format.js";

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

  console.log(`\n  Sessions (${sessions.length} total)\n`);
  console.log(
    "  " +
      "ID".padEnd(12) +
      "Started".padEnd(22) +
      "Calls".padEnd(10) +
      "Last Tool".padEnd(16) +
      "Status"
  );
  console.log("  " + "─".repeat(68));

  for (const s of display) {
    const status = s.isActive ? "\x1b[32m● live\x1b[0m" : "\x1b[90m○ done\x1b[0m";
    console.log(
      "  " +
        shortSessionId(s.id).padEnd(12) +
        relativeTime(s.startedAt).padEnd(22) +
        formatNumber(s.totalCalls).padEnd(10) +
        (s.lastTool || "N/A").padEnd(16) +
        status
    );
  }
  console.log();
}
