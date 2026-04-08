import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rm, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { TokenUsage } from "../../types/index.js";

let currentTmpDir = "";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: () => currentTmpDir,
  };
});

const makeEntry = (skill: string, tokens: number, tasks: number): TokenUsage => ({
  skill,
  agent: "sr-backend",
  tokens,
  tasksCompleted: tasks,
  timestamp: "2024-01-01T10:00:00.000Z",
});

describe("roi-calculator", () => {
  beforeEach(async () => {
    currentTmpDir = await mkdtemp(join(tmpdir(), "bw-roi-calc-test-"));
  });

  afterEach(async () => {
    await rm(currentTmpDir, { recursive: true, force: true });
    currentTmpDir = "";
  });

  it("calculateROI returns empty array when no data", async () => {
    const { calculateROI } = await import("../roi-calculator.js");
    const results = await calculateROI();
    expect(results).toEqual([]);
  });

  it("calculateROI computes correct ROI formula", async () => {
    const { recordTokenUsage } = await import("../token-tracker.js");
    const { calculateROI } = await import("../roi-calculator.js");
    // 10000 tokens, 2 tasks => roi = 2 / (10000/10000) = 2.0
    await recordTokenUsage(makeEntry("trio", 10000, 2));
    const results = await calculateROI();
    expect(results).toHaveLength(1);
    expect(results[0].skill).toBe("trio");
    expect(results[0].roi).toBeCloseTo(2.0);
    expect(results[0].tokensPerTask).toBeCloseTo(5000);
  });

  it("calculateROI sorts by ROI descending", async () => {
    const { recordTokenUsage } = await import("../token-tracker.js");
    const { calculateROI } = await import("../roi-calculator.js");
    // blitz: 5000 tokens, 5 tasks => roi = 5 / 0.5 = 10.0
    // solo: 20000 tokens, 1 task => roi = 1 / 2.0 = 0.5
    await recordTokenUsage(makeEntry("solo", 20000, 1));
    await recordTokenUsage(makeEntry("blitz", 5000, 5));
    const results = await calculateROI();
    expect(results[0].skill).toBe("blitz");
    expect(results[1].skill).toBe("solo");
    expect(results[0].roi).toBeGreaterThan(results[1].roi);
  });

  it("getROISummary returns no data message when empty", async () => {
    const { getROISummary } = await import("../roi-calculator.js");
    const summary = await getROISummary();
    expect(summary).toBe("ROI: no data");
  });

  it("getROISummary formats correctly with single skill", async () => {
    const { recordTokenUsage } = await import("../token-tracker.js");
    const { getROISummary } = await import("../roi-calculator.js");
    await recordTokenUsage(makeEntry("trio", 10000, 3));
    const summary = await getROISummary();
    expect(summary).toMatch(/^ROI: trio \d+\.\dx$/);
  });

  it("getROISummary formats multiple skills with pipe separator", async () => {
    const { recordTokenUsage } = await import("../token-tracker.js");
    const { getROISummary } = await import("../roi-calculator.js");
    await recordTokenUsage(makeEntry("blitz", 5000, 5));
    await recordTokenUsage(makeEntry("trio", 10000, 2));
    await recordTokenUsage(makeEntry("solo", 30000, 1));
    const summary = await getROISummary();
    expect(summary).toMatch(/^ROI: .+ \| .+ \| .+$/);
    expect(summary.startsWith("ROI: ")).toBe(true);
  });

  it("calculateROI handles zero tokens gracefully", async () => {
    const { recordTokenUsage } = await import("../token-tracker.js");
    const { calculateROI } = await import("../roi-calculator.js");
    await recordTokenUsage(makeEntry("solo", 0, 1));
    const results = await calculateROI();
    expect(results[0].roi).toBe(0);
  });
});
