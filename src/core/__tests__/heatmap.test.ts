import { describe, it, expect } from "vitest";
import { buildHeatmap } from "../heatmap.js";
import type { Session } from "../types.js";

function makeSession(daysAgo: number): Session {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id: `session-${daysAgo}`,
    startedAt: date,
    updatedAt: date,
    toolCounts: { Read: 5 },
    totalCalls: 5,
    lastTool: "Read",
    prompts: [],
    meta: null,
    subagents: [],
    isActive: false,
  };
}

describe("buildHeatmap", () => {
  it("builds 365-day heatmap", () => {
    const sessions = [makeSession(0), makeSession(1), makeSession(1)];
    const data = buildHeatmap(sessions, 365);

    expect(data.days.length).toBe(365);
    expect(data.totalSessions).toBe(3);
    expect(data.activeDays).toBe(2);
  });

  it("calculates streak correctly", () => {
    const sessions = [makeSession(0), makeSession(1), makeSession(2)];
    const data = buildHeatmap(sessions, 365);

    expect(data.streak).toBe(3);
  });

  it("streak breaks on gap", () => {
    const sessions = [makeSession(0), makeSession(2)]; // gap on day 1
    const data = buildHeatmap(sessions, 365);

    expect(data.streak).toBe(1);
  });

  it("assigns levels based on quartiles", () => {
    // 4 sessions on one day, 1 on another
    const sessions = [
      makeSession(0),
      makeSession(0),
      makeSession(0),
      makeSession(0),
      makeSession(5),
    ];
    const data = buildHeatmap(sessions, 365);

    const today = data.days[data.days.length - 1]!;
    expect(today.level).toBe(4); // max

    const day5 = data.days[data.days.length - 6]!;
    expect(day5.level).toBe(1); // low
  });
});
