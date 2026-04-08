import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rm, mkdtemp } from "node:fs/promises";
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

function makeEntry(overrides: Partial<AllocationOutcome> = {}): AllocationOutcome {
  return {
    domain: "backend",
    agent: "sr-backend",
    mode: "solo",
    success: true,
    duration: 30000,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("optimizer", () => {
  beforeEach(async () => {
    currentTmpDir = await mkdtemp(join(tmpdir(), "bw-optimizer-test-"));
    vi.resetModules();
  });

  afterEach(async () => {
    await rm(currentTmpDir, { recursive: true, force: true });
    currentTmpDir = "";
  });

  it("recordAllocation stores the entry", async () => {
    const { recordAllocation } = await import("../optimizer.js");
    const { loadAllocations } = await import("../allocation-history.js");
    await recordAllocation(makeEntry());
    const entries = await loadAllocations();
    expect(entries).toHaveLength(1);
    expect(entries[0].domain).toBe("backend");
  });

  it("getOptimalAgent returns null when no data exists", async () => {
    const { getOptimalAgent } = await import("../optimizer.js");
    const result = await getOptimalAgent("backend");
    expect(result).toBeNull();
  });

  it("getOptimalAgent returns null when fewer than 3 runs per agent", async () => {
    const { recordAllocation, getOptimalAgent } = await import("../optimizer.js");
    await recordAllocation(makeEntry({ agent: "sr-backend" }));
    await recordAllocation(makeEntry({ agent: "sr-backend" }));
    const result = await getOptimalAgent("backend");
    expect(result).toBeNull();
  });

  it("getOptimalAgent returns best agent with 3+ runs", async () => {
    const { recordAllocation, getOptimalAgent } = await import("../optimizer.js");
    // sr-backend: 3 successes out of 3
    for (let i = 0; i < 3; i++) {
      await recordAllocation(makeEntry({ agent: "sr-backend", success: true }));
    }
    // jr-backend: 3 runs but 1 success
    await recordAllocation(makeEntry({ agent: "jr-backend", success: true }));
    await recordAllocation(makeEntry({ agent: "jr-backend", success: false }));
    await recordAllocation(makeEntry({ agent: "jr-backend", success: false }));
    const result = await getOptimalAgent("backend");
    expect(result).toBe("sr-backend");
  });

  it("getOptimalAgent only considers entries for the given domain", async () => {
    const { recordAllocation, getOptimalAgent } = await import("../optimizer.js");
    for (let i = 0; i < 3; i++) {
      await recordAllocation(makeEntry({ domain: "frontend", agent: "sr-frontend" }));
    }
    const result = await getOptimalAgent("backend");
    expect(result).toBeNull();
  });

  it("getOptimizationStatus returns hasEnoughData false when fewer than 10 allocations", async () => {
    const { recordAllocation, getOptimizationStatus } = await import("../optimizer.js");
    for (let i = 0; i < 5; i++) {
      await recordAllocation(makeEntry());
    }
    const status = await getOptimizationStatus();
    expect(status.totalAllocations).toBe(5);
    expect(status.hasEnoughData).toBe(false);
  });

  it("getOptimizationStatus returns hasEnoughData true with 10+ allocations", async () => {
    const { recordAllocation, getOptimizationStatus } = await import("../optimizer.js");
    for (let i = 0; i < 10; i++) {
      await recordAllocation(makeEntry());
    }
    const status = await getOptimizationStatus();
    expect(status.totalAllocations).toBe(10);
    expect(status.hasEnoughData).toBe(true);
  });

  it("getOptimizationStatus tracks multiple domains", async () => {
    const { recordAllocation, getOptimizationStatus } = await import("../optimizer.js");
    await recordAllocation(makeEntry({ domain: "backend", agent: "sr-backend" }));
    await recordAllocation(makeEntry({ domain: "frontend", agent: "sr-frontend" }));
    await recordAllocation(makeEntry({ domain: "infra", agent: "devops" }));
    const status = await getOptimizationStatus();
    expect(status.domainsTracked).toBe(3);
    expect(status.topAgentPerDomain["backend"].agent).toBe("sr-backend");
    expect(status.topAgentPerDomain["frontend"].agent).toBe("sr-frontend");
    expect(status.topAgentPerDomain["infra"].agent).toBe("devops");
  });
});
