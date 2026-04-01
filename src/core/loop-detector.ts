import type { ToolEvent, LoopPattern } from "../data/types.js";

const DEFAULT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_THRESHOLD = 4; // 4+ same tool+file = loop

export interface LoopDetectorOptions {
  windowMs?: number;
  threshold?: number;
}

export function detectLoops(
  events: ToolEvent[],
  options: LoopDetectorOptions = {}
): LoopPattern[] {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;

  const loops: LoopPattern[] = [];

  // Group events by session
  const bySession = new Map<string, ToolEvent[]>();
  for (const event of events) {
    const sid = event.sessionId;
    if (!bySession.has(sid)) bySession.set(sid, []);
    bySession.get(sid)!.push(event);
  }

  for (const [sessionId, sessionEvents] of bySession) {
    // Track tool+file combinations within sliding window
    const sorted = sessionEvents.sort((a, b) => a.timestamp - b.timestamp);

    // Build key = tool + target file
    const keyed = sorted
      .filter((e) => e.event === "post" || e.event === "pre")
      .map((e) => ({
        key: `${e.toolName}:${getTarget(e)}`,
        tool: e.toolName,
        file: getTarget(e),
        ts: e.timestamp,
      }))
      .filter((e) => e.file !== "unknown");

    // Sliding window detection
    const seen = new Map<
      string,
      { tool: string; file: string; timestamps: number[] }
    >();

    for (const entry of keyed) {
      if (!seen.has(entry.key)) {
        seen.set(entry.key, {
          tool: entry.tool,
          file: entry.file,
          timestamps: [],
        });
      }

      const record = seen.get(entry.key)!;

      // Remove timestamps outside window
      record.timestamps = record.timestamps.filter(
        (t) => entry.ts - t <= windowMs
      );
      record.timestamps.push(entry.ts);

      if (record.timestamps.length >= threshold) {
        // Check if we already reported this loop
        const existing = loops.find(
          (l) =>
            l.sessionId === sessionId &&
            l.tool === record.tool &&
            l.file === record.file
        );

        if (existing) {
          existing.count = record.timestamps.length;
          existing.lastSeen = entry.ts;
        } else {
          loops.push({
            sessionId,
            tool: record.tool,
            file: record.file,
            count: record.timestamps.length,
            firstSeen: record.timestamps[0]!,
            lastSeen: entry.ts,
            windowMs,
          });
        }
      }
    }
  }

  return loops.sort((a, b) => b.count - a.count);
}

/**
 * Detect loops from aggregated session stats (no hooks needed).
 * Uses heuristics: if a single tool accounts for >60% of calls
 * and total calls are high, it's likely a loop.
 */
export function detectLoopsFromStats(sessions: {
  id: string;
  toolCounts: Record<string, number>;
  totalCalls: number;
}[]): Array<{ sessionId: string; tool: string; ratio: number; calls: number }> {
  const suspicious: Array<{
    sessionId: string;
    tool: string;
    ratio: number;
    calls: number;
  }> = [];

  for (const session of sessions) {
    if (session.totalCalls < 20) continue; // Skip tiny sessions

    for (const [tool, count] of Object.entries(session.toolCounts)) {
      const ratio = count / session.totalCalls;
      if (ratio > 0.6 && count > 15) {
        suspicious.push({
          sessionId: session.id,
          tool,
          ratio,
          calls: count,
        });
      }
    }
  }

  return suspicious.sort((a, b) => b.ratio - a.ratio);
}

function getTarget(event: ToolEvent): string {
  if (event.input?.file_path) return event.input.file_path;
  if (event.output?.filePath) return event.output.filePath;
  if (event.input?.command) {
    // Extract file from common commands
    const cmd = event.input.command;
    const match = cmd.match(/(?:cat|head|tail|less|vim|nano|code)\s+(\S+)/);
    if (match) return match[1]!;
  }
  return "unknown";
}
