import { describe, it, expect } from "vitest";
import { summarize } from "../result-summarizer.js";
import type { SkillResult } from "../result-summarizer.js";

function makeResult(overrides: Partial<SkillResult> = {}): SkillResult {
  return {
    total: 3,
    done: 3,
    ...overrides,
  };
}

describe("summarize", () => {
  it("returns a 1-line BW summary for all done", () => {
    const line = summarize("trio", makeResult({ total: 3, done: 3 }));
    expect(line).toBe("[BW] ✓ 3/3 done");
  });

  it("includes report file path when provided", () => {
    const line = summarize(
      "trio",
      makeResult({ reportFile: ".bestwork/reports/trio-1234567890.md" })
    );
    expect(line).toBe(
      "[BW] ✓ 3/3 done — details: .bestwork/reports/trio-1234567890.md"
    );
  });

  it("uses ✗ when not all tasks done", () => {
    const line = summarize("blitz", makeResult({ total: 5, done: 3 }));
    expect(line).toBe("[BW] ✗ 3/5 done");
  });

  it("handles blitz skill name", () => {
    const line = summarize("blitz", makeResult({ total: 10, done: 10 }));
    expect(line).toContain("[BW] ✓ 10/10 done");
  });

  it("handles pipeline-run skill name", () => {
    const line = summarize("pipeline-run", makeResult({ total: 4, done: 2 }));
    expect(line).toBe("[BW] ✗ 2/4 done");
  });

  it("handles deliver skill name", () => {
    const line = summarize("deliver", makeResult({ total: 2, done: 2 }));
    expect(line).toBe("[BW] ✓ 2/2 done");
  });

  it("starts with [BW] tag", () => {
    const line = summarize("trio", makeResult());
    expect(line.startsWith("[BW]")).toBe(true);
  });
});
