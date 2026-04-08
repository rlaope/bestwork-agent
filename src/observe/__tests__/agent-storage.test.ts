import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFile, rm, mkdtemp } from "node:fs/promises";
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

const sampleRun: AgentRun = {
  agent: "sr-backend",
  task: "implement auth endpoint",
  duration: 45000,
  success: true,
  retries: 0,
  timestamp: "2024-01-01T10:00:00.000Z",
};

describe("agent-storage", () => {
  beforeEach(async () => {
    currentTmpDir = await mkdtemp(join(tmpdir(), "bw-agent-storage-test-"));
  });

  afterEach(async () => {
    await rm(currentTmpDir, { recursive: true, force: true });
    currentTmpDir = "";
  });

  it("saveAgentRun appends to JSONL file", async () => {
    const { saveAgentRun } = await import("../agent-storage.js");
    await saveAgentRun(sampleRun);
    const content = await readFile(
      join(currentTmpDir, ".bestwork", "agents", "runs.jsonl"),
      "utf8"
    );
    const parsed = JSON.parse(content.trim()) as AgentRun;
    expect(parsed.agent).toBe("sr-backend");
    expect(parsed.success).toBe(true);
  });

  it("saveAgentRun creates directory if missing", async () => {
    const { saveAgentRun } = await import("../agent-storage.js");
    await saveAgentRun(sampleRun);
    const content = await readFile(
      join(currentTmpDir, ".bestwork", "agents", "runs.jsonl"),
      "utf8"
    );
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it("loadAgentRuns reads all entries", async () => {
    const { saveAgentRun, loadAgentRuns } = await import("../agent-storage.js");
    const run2: AgentRun = { ...sampleRun, agent: "critic-security" };
    await saveAgentRun(sampleRun);
    await saveAgentRun(run2);
    const runs = await loadAgentRuns();
    expect(runs).toHaveLength(2);
  });

  it("loadAgentRuns filters by agent name", async () => {
    const { saveAgentRun, loadAgentRuns } = await import("../agent-storage.js");
    const run2: AgentRun = { ...sampleRun, agent: "critic-security" };
    await saveAgentRun(sampleRun);
    await saveAgentRun(run2);
    const runs = await loadAgentRuns("sr-backend");
    expect(runs).toHaveLength(1);
    expect(runs[0].agent).toBe("sr-backend");
  });

  it("loadAgentRuns returns empty array when file does not exist", async () => {
    const { loadAgentRuns } = await import("../agent-storage.js");
    const runs = await loadAgentRuns();
    expect(runs).toEqual([]);
  });
});
