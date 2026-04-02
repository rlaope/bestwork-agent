import { describe, it, expect } from "vitest";
import { detectLoops, detectLoopsFromStats } from "../loop-detector.js";
import type { ToolEvent } from "../../data/types.js";

function makeEvent(
  overrides: Partial<ToolEvent> & { timestamp: number }
): ToolEvent {
  return {
    sessionId: "test-session",
    toolName: "Edit",
    event: "post",
    input: { file_path: "/src/app.ts" },
    ...overrides,
  };
}

describe("detectLoops", () => {
  it("detects repeated tool+file pattern", () => {
    const events: ToolEvent[] = [];
    const base = Date.now();
    for (let i = 0; i < 6; i++) {
      events.push(
        makeEvent({
          timestamp: base + i * 30000, // every 30s
          toolName: "Edit",
          input: { file_path: "/src/app.ts" },
        })
      );
    }

    const loops = detectLoops(events, { threshold: 4, windowMs: 300000 });
    expect(loops.length).toBe(1);
    expect(loops[0]!.tool).toBe("Edit");
    expect(loops[0]!.file).toBe("/src/app.ts");
    expect(loops[0]!.count).toBe(6);
  });

  it("does not flag below threshold", () => {
    const base = Date.now();
    const events = [
      makeEvent({ timestamp: base, toolName: "Read" }),
      makeEvent({ timestamp: base + 10000, toolName: "Read" }),
    ];

    const loops = detectLoops(events, { threshold: 4 });
    expect(loops.length).toBe(0);
  });

  it("ignores events outside window", () => {
    const base = Date.now();
    const events: ToolEvent[] = [];

    // 4 events spread over 20 minutes (outside 5min window)
    for (let i = 0; i < 4; i++) {
      events.push(
        makeEvent({
          timestamp: base + i * 6 * 60000,
          toolName: "Edit",
          input: { file_path: "/src/app.ts" },
        })
      );
    }

    const loops = detectLoops(events, {
      threshold: 4,
      windowMs: 5 * 60 * 1000,
    });
    expect(loops.length).toBe(0);
  });
});

describe("detectLoopsFromStats", () => {
  it("flags sessions where one tool dominates", () => {
    const sessions = [
      {
        id: "s1",
        toolCounts: { Edit: 50, Read: 5, Bash: 3 },
        totalCalls: 58,
      },
    ];

    const suspicious = detectLoopsFromStats(sessions);
    expect(suspicious.length).toBe(1);
    expect(suspicious[0]!.tool).toBe("Edit");
    expect(suspicious[0]!.ratio).toBeGreaterThan(0.6);
  });

  it("ignores small sessions", () => {
    const sessions = [
      { id: "s1", toolCounts: { Read: 8 }, totalCalls: 8 },
    ];

    const suspicious = detectLoopsFromStats(sessions);
    expect(suspicious.length).toBe(0);
  });
});
