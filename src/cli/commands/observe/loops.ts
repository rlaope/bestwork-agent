import { readAllEvents } from "../../../data/store.js";
import { aggregateSessions } from "../../../observe/aggregator.js";
import { detectLoops, detectLoopsFromStats } from "../../../observe/loop-detector.js";
import { shortSessionId } from "../../../utils/format.js";

export async function loopsCommand() {
  // Try hooks data for precise detection
  const events = await readAllEvents();

  if (events.length > 0) {
    const loops = detectLoops(events);

    if (loops.length === 0) {
      console.log("\n  No loops detected. Your agent is staying on track.\n");
      return;
    }

    console.log(`\n  Loop Detection — ${loops.length} pattern(s) found\n`);

    for (const loop of loops) {
      const duration = ((loop.lastSeen - loop.firstSeen) / 1000).toFixed(0);
      console.log(
        `  \x1b[31m⚠\x1b[0m  ${shortSessionId(loop.sessionId)}  ` +
          `${loop.tool} → ${shortPath(loop.file)}  ` +
          `\x1b[33m${loop.count}x\x1b[0m in ${duration}s`
      );
    }
    console.log();
    return;
  }

  // Fallback: heuristic detection from session stats
  const sessions = await aggregateSessions();
  const suspicious = detectLoopsFromStats(sessions);

  if (suspicious.length === 0) {
    console.log("\n  No suspicious patterns found.\n");
    console.log("  For precise loop detection, run `nysm install` to enable hooks.\n");
    return;
  }

  console.log(
    `\n  Suspicious Patterns — ${suspicious.length} session(s)\n`
  );
  console.log("  (Heuristic — install hooks for precise detection)\n");

  for (const s of suspicious) {
    const pct = (s.ratio * 100).toFixed(0);
    console.log(
      `  \x1b[33m⚠\x1b[0m  ${shortSessionId(s.sessionId)}  ` +
        `${s.tool} used ${s.calls}x (${pct}% of session)`
    );
  }

  console.log("\n  Run `nysm install` for real-time loop detection.\n");
}

function shortPath(path: string): string {
  if (path.length <= 40) return path;
  return "…" + path.slice(-39);
}
