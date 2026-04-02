import { describe, it, expect, vi, beforeEach } from "vitest";
import { getToolRanking, getDailySummary } from "../aggregator.js";
import type { Session } from "../../types/index.js";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "test-session-1",
    startedAt: new Date(),
    updatedAt: new Date(),
    toolCounts: { Read: 10, Bash: 5, Edit: 3 },
    totalCalls: 18,
    lastTool: "Read",
    prompts: [],
    meta: null,
    subagents: [],
    isActive: false,
    ...overrides,
  };
}

describe("getToolRanking", () => {
  it("ranks tools by count descending", () => {
    const sessions = [makeSession()];
    const ranking = getToolRanking(sessions);

    expect(ranking[0]?.name).toBe("Read");
    expect(ranking[0]?.count).toBe(10);
    expect(ranking[1]?.name).toBe("Bash");
    expect(ranking[2]?.name).toBe("Edit");
  });

  it("calculates percentage correctly", () => {
    const sessions = [makeSession()];
    const ranking = getToolRanking(sessions);
    const total = ranking.reduce((sum, r) => sum + r.count, 0);

    expect(total).toBe(18);
    expect(ranking[0]?.percentage).toBeCloseTo(55.56, 1);
  });

  it("aggregates across multiple sessions", () => {
    const sessions = [
      makeSession({ toolCounts: { Read: 10, Bash: 5 }, totalCalls: 15 }),
      makeSession({
        id: "s2",
        toolCounts: { Read: 3, Write: 7 },
        totalCalls: 10,
      }),
    ];
    const ranking = getToolRanking(sessions);

    expect(ranking.find((r) => r.name === "Read")?.count).toBe(13);
    expect(ranking.find((r) => r.name === "Write")?.count).toBe(7);
  });

  it("returns empty array for no sessions", () => {
    const ranking = getToolRanking([]);
    expect(ranking).toHaveLength(0);
  });
});

describe("getDailySummary", () => {
  it("filters sessions by date", () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);

    const sessions = [
      makeSession({ startedAt: today, totalCalls: 10 }),
      makeSession({ id: "s2", startedAt: yesterday, totalCalls: 20 }),
    ];

    const summary = getDailySummary(sessions, today);
    expect(summary.totalSessions).toBe(1);
    expect(summary.totalCalls).toBe(10);
  });

  it("returns zero stats for date with no sessions", () => {
    const farFuture = new Date("2099-01-01");
    const summary = getDailySummary([makeSession()], farFuture);

    expect(summary.totalSessions).toBe(0);
    expect(summary.totalCalls).toBe(0);
    expect(summary.topTool).toBe("N/A");
  });
});
