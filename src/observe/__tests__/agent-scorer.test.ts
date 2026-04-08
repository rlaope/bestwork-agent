import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentRun } from "../../types/index.js";

let currentTmpDir = "";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: () => currentTmpDir,
  };
});

describe("agent-scorer", () => {
  beforeEach(async () => {
    currentTmpDir = await mkdtemp(join(tmpdir(), "bw-agent-scorer-test-"));
  });

  afterEach(async () => {
    await rm(currentTmpDir, { recursive: true, force: true });
    currentTmpDir = "";
  });

  it("recordAgentRun stores data correctly", async () => {
    const { recordAgentRun, getAgentScore } = await import("../agent-scorer.js");
    const run: AgentRun = {
      agent: "sr-backend",
      task: "implement auth",
      duration: 30000,
      success: true,
      retries: 0,
      timestamp: "2024-01-01T10:00:00.000Z",
    };
    await recordAgentRun(run);
    const score = await getAgentScore("sr-backend");
    expect(score).not.toBeNull();
    expect(score!.agent).toBe("sr-backend");
    expect(score!.totalRuns).toBe(1);
    expect(score!.successRate).toBe(1);
  });

  it("getAgentScores returns sorted rankings by effectiveness", async () => {
    const { recordAgentRun, getAgentScores } = await import("../agent-scorer.js");
    await recordAgentRun({
      agent: "fast-agent",
      task: "quick task",
      duration: 5000,
      success: true,
      retries: 0,
      timestamp: "2024-01-01T10:00:00.000Z",
    });
    await recordAgentRun({
      agent: "slow-agent",
      task: "hard task",
      duration: 119000,
      success: false,
      retries: 2,
      timestamp: "2024-01-01T10:01:00.000Z",
    });
    const scores = await getAgentScores();
    expect(scores).toHaveLength(2);
    expect(scores[0].effectiveness).toBeGreaterThan(scores[1].effectiveness);
    expect(scores[0].agent).toBe("fast-agent");
  });

  it("effectiveness formula: successRate*60 + max(0,1-avgRetries/3)*20 + speedScore*20", async () => {
    const { recordAgentRun, getAgentScore } = await import("../agent-scorer.js");
    await recordAgentRun({
      agent: "test-agent",
      task: "task",
      duration: 60000,
      success: true,
      retries: 0,
      timestamp: "2024-01-01T10:00:00.000Z",
    });
    const score = await getAgentScore("test-agent");
    expect(score).not.toBeNull();
    // successRate=1, avgRetries=0, duration=60000
    // speedScore = max(0, 1 - 60000/120000) = 0.5
    // effectiveness = 1*60 + max(0,1-0/3)*20 + 0.5*20 = 60+20+10 = 90
    expect(score!.effectiveness).toBeCloseTo(90, 5);
  });

  it("handles empty data gracefully", async () => {
    const { getAgentScores, getAgentScore } = await import("../agent-scorer.js");
    const scores = await getAgentScores();
    expect(scores).toEqual([]);
    const score = await getAgentScore("nonexistent");
    expect(score).toBeNull();
  });

  it("filters by agent name", async () => {
    const { recordAgentRun, getAgentScore } = await import("../agent-scorer.js");
    await recordAgentRun({
      agent: "agent-a",
      task: "task a",
      duration: 10000,
      success: true,
      retries: 0,
      timestamp: "2024-01-01T10:00:00.000Z",
    });
    await recordAgentRun({
      agent: "agent-b",
      task: "task b",
      duration: 20000,
      success: false,
      retries: 1,
      timestamp: "2024-01-01T10:01:00.000Z",
    });
    const scoreA = await getAgentScore("agent-a");
    const scoreB = await getAgentScore("agent-b");
    expect(scoreA!.totalRuns).toBe(1);
    expect(scoreA!.successRate).toBe(1);
    expect(scoreB!.successRate).toBe(0);
  });
});
