import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFile, rm, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AllocationOutcome } from "../../types/index.js";

let currentTmpDir = "";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: () => currentTmpDir,
  };
});

const sampleEntry: AllocationOutcome = {
  domain: "backend",
  agent: "sr-backend",
  mode: "solo",
  success: true,
  duration: 30000,
  timestamp: "2024-01-01T10:00:00.000Z",
};

describe("allocation-history", () => {
  beforeEach(async () => {
    currentTmpDir = await mkdtemp(join(tmpdir(), "bw-alloc-history-test-"));
    vi.resetModules();
  });

  afterEach(async () => {
    await rm(currentTmpDir, { recursive: true, force: true });
    currentTmpDir = "";
  });

  it("saveAllocation appends to JSONL file", async () => {
    const { saveAllocation } = await import("../allocation-history.js");
    await saveAllocation(sampleEntry);
    const content = await readFile(
      join(currentTmpDir, ".bestwork", "optimization", "allocations.jsonl"),
      "utf8"
    );
    const parsed = JSON.parse(content.trim()) as AllocationOutcome;
    expect(parsed.domain).toBe("backend");
    expect(parsed.agent).toBe("sr-backend");
    expect(parsed.success).toBe(true);
  });

  it("saveAllocation creates directory if missing", async () => {
    const { saveAllocation } = await import("../allocation-history.js");
    await saveAllocation(sampleEntry);
    const content = await readFile(
      join(currentTmpDir, ".bestwork", "optimization", "allocations.jsonl"),
      "utf8"
    );
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it("loadAllocations reads all entries", async () => {
    const { saveAllocation, loadAllocations } = await import("../allocation-history.js");
    const entry2: AllocationOutcome = { ...sampleEntry, domain: "frontend", agent: "sr-frontend" };
    await saveAllocation(sampleEntry);
    await saveAllocation(entry2);
    const entries = await loadAllocations();
    expect(entries).toHaveLength(2);
  });

  it("loadAllocations filters by domain", async () => {
    const { saveAllocation, loadAllocations } = await import("../allocation-history.js");
    const entry2: AllocationOutcome = { ...sampleEntry, domain: "frontend", agent: "sr-frontend" };
    await saveAllocation(sampleEntry);
    await saveAllocation(entry2);
    const entries = await loadAllocations("backend");
    expect(entries).toHaveLength(1);
    expect(entries[0].domain).toBe("backend");
  });

  it("loadAllocations returns empty array when file does not exist", async () => {
    const { loadAllocations } = await import("../allocation-history.js");
    const entries = await loadAllocations();
    expect(entries).toEqual([]);
  });
});
