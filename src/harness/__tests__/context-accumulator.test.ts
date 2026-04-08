import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpDir: string;

describe("context-accumulator", () => {
  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "bw-ctx-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    vi.resetModules();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("accumulateDecision writes a formatted entry to decisions.md", async () => {
    const { accumulateDecision } = await import("../context-accumulator.js");
    const { readFile } = await import("node:fs/promises");

    await accumulateDecision({
      title: "Use file-based storage",
      text: "Store context in markdown files",
      reason: "Simple and human-readable",
      impact: "Low — no database dependency",
      date: "2024-01-15",
    });

    const content = await readFile(join(tmpDir, ".bestwork", "context", "decisions.md"), "utf-8");
    expect(content).toContain("## 2024-01-15: Use file-based storage");
    expect(content).toContain("- **Decision**: Store context in markdown files");
    expect(content).toContain("- **Reason**: Simple and human-readable");
    expect(content).toContain("- **Impact**: Low — no database dependency");
  });

  it("accumulateDecision appends multiple entries", async () => {
    const { accumulateDecision } = await import("../context-accumulator.js");
    const { readFile } = await import("node:fs/promises");

    await accumulateDecision({ title: "First", text: "A", reason: "B", impact: "C", date: "2024-01-01" });
    await accumulateDecision({ title: "Second", text: "D", reason: "E", impact: "F", date: "2024-01-02" });

    const content = await readFile(join(tmpDir, ".bestwork", "context", "decisions.md"), "utf-8");
    expect(content).toContain("## 2024-01-01: First");
    expect(content).toContain("## 2024-01-02: Second");
  });

  it("accumulateRisk writes to risks.md", async () => {
    const { accumulateRisk } = await import("../context-accumulator.js");
    const { readFile } = await import("node:fs/promises");

    await accumulateRisk("Token expiry may break CI overnight");

    const content = await readFile(join(tmpDir, ".bestwork", "context", "risks.md"), "utf-8");
    expect(content).toContain("Token expiry may break CI overnight");
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}\]/);
  });

  it("accumulateTechDebt writes to tech-debt.md", async () => {
    const { accumulateTechDebt } = await import("../context-accumulator.js");
    const { readFile } = await import("node:fs/promises");

    await accumulateTechDebt("Replace sync fs calls with async in HUD");

    const content = await readFile(join(tmpDir, ".bestwork", "context", "tech-debt.md"), "utf-8");
    expect(content).toContain("Replace sync fs calls with async in HUD");
  });

  it("getContext returns empty strings when no files exist", async () => {
    const { getContext } = await import("../context-accumulator.js");

    const ctx = await getContext();
    expect(ctx.decisions).toBe("");
    expect(ctx.risks).toBe("");
    expect(ctx.techDebt).toBe("");
    expect(ctx.index).toBeNull();
  });

  it("getContext returns written content", async () => {
    const { accumulateDecision, accumulateRisk, accumulateTechDebt, getContext } = await import("../context-accumulator.js");

    await accumulateDecision({ title: "T", text: "X", reason: "Y", impact: "Z", date: "2024-03-01" });
    await accumulateRisk("Some risk");
    await accumulateTechDebt("Some debt");

    const ctx = await getContext();
    expect(ctx.decisions).toContain("## 2024-03-01: T");
    expect(ctx.risks).toContain("Some risk");
    expect(ctx.techDebt).toContain("Some debt");
  });
});
