import { EventEmitter } from "node:events";
import { existsSync, watch, statSync, openSync, readSync, closeSync, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ToolEvent } from "../data/types.js";
import { logger } from "../harness/logger.js";

/**
 * Tail-watches a session JSONL file and emits structured health snapshots.
 *
 * Existing observability layer (aggregator, loop-detector, agent-scorer) is
 * batch-only — it computes off the full file after the fact. This module is
 * the realtime counterpart: it tracks the file's read offset, parses any new
 * lines on every change, and re-derives a "what's the agent doing right now"
 * health verdict on each tick.
 *
 * Designed so the existing `bestwork live` ink UI can adopt it without
 * touching the rest of the observability code.
 */

export interface HealthSnapshot {
  /** Session being watched. */
  sessionId: string;
  /** Total events seen since stream started. */
  totalEvents: number;
  /** Tool calls in the last 60 seconds. */
  callsPerMinute: number;
  /** Tool with the most calls in the recent window, or null. */
  topTool: { name: string; count: number } | null;
  /** Recent events with the same tool+file pair (loop signal). */
  loopHint: { tool: string; target: string; hits: number } | null;
  /** Latest event timestamp (ms). */
  lastEventAt: number | null;
  /** Verdict derived from the metrics. */
  verdict: "idle" | "active" | "stuck" | "looping";
}

const RECENT_WINDOW_MS = 60_000;
const LOOP_WINDOW = 6; // last N events scanned for repetition
const LOOP_THRESHOLD = 4; // ≥ this many same-tool+file in window → loop

function dataFileFor(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw new Error("invalid sessionId");
  return join(homedir(), ".bestwork", "data", `${safe}.jsonl`);
}

interface LiveSessionStreamEvents {
  snapshot: (snap: HealthSnapshot) => void;
  error: (err: unknown) => void;
}

export class LiveSessionStream extends EventEmitter {
  private filePath = "";
  private sessionId = "";
  private watcher: FSWatcher | null = null;
  private offset = 0;
  private buffer = "";
  private events: ToolEvent[] = [];
  private maxBuffer = 500;

  override on<K extends keyof LiveSessionStreamEvents>(
    event: K,
    listener: LiveSessionStreamEvents[K],
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override emit<K extends keyof LiveSessionStreamEvents>(
    event: K,
    ...args: Parameters<LiveSessionStreamEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  start(sessionId: string): void {
    this.sessionId = sessionId;
    this.filePath = dataFileFor(sessionId);

    if (!existsSync(this.filePath)) {
      // File may not exist yet; emit an idle snapshot and watch the directory
      this.emitSnapshot();
      return;
    }

    this.consumeNewBytes();

    try {
      this.watcher = watch(this.filePath, () => {
        try {
          this.consumeNewBytes();
        } catch (err) {
          logger.warn("live-stream", "consumeNewBytes failed", err);
          this.emit("error", err);
        }
      });
    } catch (err) {
      logger.warn("live-stream", `failed to attach watcher to ${this.filePath}`, err);
      this.emit("error", err);
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private consumeNewBytes(): void {
    const stat = statSync(this.filePath);
    if (stat.size <= this.offset) {
      // truncation or no growth — reset if shrunk
      if (stat.size < this.offset) {
        this.offset = 0;
        this.buffer = "";
      }
      return;
    }

    const fd = openSync(this.filePath, "r");
    try {
      const len = stat.size - this.offset;
      const buf = Buffer.alloc(len);
      readSync(fd, buf, 0, len, this.offset);
      this.buffer += buf.toString("utf-8");
      this.offset = stat.size;
    } finally {
      closeSync(fd);
    }

    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const ev = JSON.parse(line) as ToolEvent;
        this.events.push(ev);
        if (this.events.length > this.maxBuffer) {
          this.events.splice(0, this.events.length - this.maxBuffer);
        }
      } catch (err) {
        logger.debug("live-stream", `malformed event line skipped`, err);
      }
    }
    this.emitSnapshot();
  }

  /** Compute and emit the current health snapshot. Public for testability. */
  emitSnapshot(): HealthSnapshot {
    const snap = this.computeSnapshot();
    this.emit("snapshot", snap);
    return snap;
  }

  computeSnapshot(): HealthSnapshot {
    const now = Date.now();
    const events = this.events;
    const lastEventAt = events.length > 0 ? events[events.length - 1]!.timestamp : null;

    const recent = events.filter((e) => now - e.timestamp <= RECENT_WINDOW_MS);
    const callsPerMinute = recent.length;

    const toolCounts = new Map<string, number>();
    for (const e of recent) toolCounts.set(e.toolName, (toolCounts.get(e.toolName) ?? 0) + 1);
    let topTool: HealthSnapshot["topTool"] = null;
    for (const [name, count] of toolCounts) {
      if (!topTool || count > topTool.count) topTool = { name, count };
    }

    const loopHint = this.detectLoopHint();

    let verdict: HealthSnapshot["verdict"] = "idle";
    if (loopHint) verdict = "looping";
    else if (lastEventAt !== null && now - lastEventAt > 120_000 && recent.length === 0) verdict = "stuck";
    else if (recent.length > 0) verdict = "active";

    return {
      sessionId: this.sessionId,
      totalEvents: events.length,
      callsPerMinute,
      topTool,
      loopHint,
      lastEventAt,
      verdict,
    };
  }

  private detectLoopHint(): HealthSnapshot["loopHint"] {
    const tail = this.events.slice(-LOOP_WINDOW);
    if (tail.length < LOOP_THRESHOLD) return null;
    const counts = new Map<string, number>();
    for (const e of tail) {
      const target = e.input?.file_path ?? e.input?.command ?? "";
      const key = `${e.toolName}::${target}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best: { tool: string; target: string; hits: number } | null = null;
    for (const [key, hits] of counts) {
      if (hits >= LOOP_THRESHOLD) {
        const [tool, target] = key.split("::");
        const candidate = { tool: tool ?? "", target: target ?? "", hits };
        if (!best || hits > best.hits) best = candidate;
      }
    }
    return best;
  }
}
