import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFile, rm, mkdtemp } from "node:fs/promises";
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

const sampleEntry: TokenUsage = {
  skill: "trio",
  agent: "sr-backend",
  tokens: 5000,
  tasksCompleted: 2,
  timestamp: "2024-01-01T10:00:00.000Z",
};

describe("token-tracker", () => {
  beforeEach(async () => {
    currentTmpDir = await mkdtemp(join(tmpdir(), "bw-token-tracker-test-"));
  });

  afterEach(async () => {
    await rm(currentTmpDir, { recursive: true, force: true });
    currentTmpDir = "";
  });

  it("recordTokenUsage appends entry to JSONL file", async () => {
    const { recordTokenUsage } = await import("../token-tracker.js");
    await recordTokenUsage(sampleEntry);
    const content = await readFile(
      join(currentTmpDir, ".bestwork", "analytics", "token-log.jsonl"),
      "utf8"
    );
    const parsed = JSON.parse(content.trim()) as TokenUsage;
    expect(parsed.skill).toBe("trio");
    expect(parsed.tokens).toBe(5000);
  });

  it("recordTokenUsage creates directory if missing", async () => {
    const { recordTokenUsage } = await import("../token-tracker.js");
    await recordTokenUsage(sampleEntry);
    const content = await readFile(
      join(currentTmpDir, ".bestwork", "analytics", "token-log.jsonl"),
      "utf8"
    );
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it("getTokenStats returns empty array when no data", async () => {
    const { getTokenStats } = await import("../token-tracker.js");
    const stats = await getTokenStats();
    expect(stats).toEqual([]);
  });

  it("getTokenStats aggregates by skill", async () => {
    const { recordTokenUsage, getTokenStats } = await import(
      "../token-tracker.js"
    );
    await recordTokenUsage(sampleEntry);
    await recordTokenUsage({ ...sampleEntry, tokens: 3000, tasksCompleted: 1 });
    await recordTokenUsage({ ...sampleEntry, skill: "blitz", tokens: 8000, tasksCompleted: 4 });
    const stats = await getTokenStats();
    const trio = stats.find((s) => s.skill === "trio");
    const blitz = stats.find((s) => s.skill === "blitz");
    expect(trio).toBeDefined();
    expect(trio!.totalTokens).toBe(8000);
    expect(trio!.totalTasks).toBe(3);
    expect(trio!.avgTokensPerTask).toBeCloseTo(8000 / 3);
    expect(blitz).toBeDefined();
    expect(blitz!.totalTokens).toBe(8000);
  });

  it("getAgentTokenStats aggregates by agent", async () => {
    const { recordTokenUsage, getAgentTokenStats } = await import(
      "../token-tracker.js"
    );
    await recordTokenUsage(sampleEntry);
    await recordTokenUsage({ ...sampleEntry, agent: "critic-qa", tokens: 2000, tasksCompleted: 1 });
    await recordTokenUsage({ ...sampleEntry, tokens: 1000, tasksCompleted: 1 });
    const stats = await getAgentTokenStats();
    const backend = stats.find((s) => s.agent === "sr-backend");
    const critic = stats.find((s) => s.agent === "critic-qa");
    expect(backend).toBeDefined();
    expect(backend!.totalTokens).toBe(6000);
    expect(backend!.totalTasks).toBe(3);
    expect(critic).toBeDefined();
    expect(critic!.totalTokens).toBe(2000);
  });

  it("getAgentTokenStats returns empty array when no data", async () => {
    const { getAgentTokenStats } = await import("../token-tracker.js");
    const stats = await getAgentTokenStats();
    expect(stats).toEqual([]);
  });

  it("recordTokenUsage appends multiple entries", async () => {
    const { recordTokenUsage, getTokenStats } = await import(
      "../token-tracker.js"
    );
    await recordTokenUsage(sampleEntry);
    await recordTokenUsage({ ...sampleEntry, skill: "solo", tokens: 1000, tasksCompleted: 1 });
    await recordTokenUsage({ ...sampleEntry, skill: "blitz", tokens: 9000, tasksCompleted: 5 });
    const stats = await getTokenStats();
    expect(stats).toHaveLength(3);
  });
});
