import { describe, it, expect } from "vitest";
import { buildExecutionPlan, autoAllocate, formatPlan } from "../orchestrator.js";

describe("buildExecutionPlan", () => {
  it("builds hierarchy plan for Full Team", () => {
    const plan = buildExecutionPlan("Full Team", "refactor auth");
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe("hierarchy");
    expect(plan!.steps.length).toBe(4);
    // Bottom-up: junior first
    expect(plan!.steps[0]!.agentId).toBe("jr-engineer");
    // C-level last
    expect(plan!.steps[3]!.agentId).toBe("cto");
    expect(plan!.steps[3]!.phase).toBe("approve");
  });

  it("builds squad plan for Feature Squad", () => {
    const plan = buildExecutionPlan("Feature Squad", "add dark mode");
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe("squad");
    expect(plan!.steps.every((s) => s.parallel)).toBe(true);
    expect(plan!.steps.every((s) => s.dependsOn.length === 0)).toBe(true);
  });

  it("builds review plan for Code Review Board", () => {
    const plan = buildExecutionPlan("Code Review Board", "review PR #42");
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe("review");
    expect(plan!.steps.every((s) => s.phase === "review")).toBe(true);
  });

  it("builds advisory plan for Architecture Review", () => {
    const plan = buildExecutionPlan("Architecture Review", "microservice split");
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe("advisory");
    expect(plan!.steps[0]!.dependsOn.length).toBe(0);
    expect(plan!.steps[1]!.dependsOn).toContain(plan!.steps[0]!.agentId);
  });

  it("returns null for unknown team", () => {
    expect(buildExecutionPlan("Nonexistent Team", "task")).toBeNull();
  });

  it("hierarchy steps have sequential dependencies", () => {
    const plan = buildExecutionPlan("Backend Team", "add API endpoint");
    expect(plan).not.toBeNull();
    for (let i = 1; i < plan!.steps.length; i++) {
      expect(plan!.steps[i]!.dependsOn).toContain(plan!.steps[i - 1]!.agentId);
    }
  });

  it("combines org role + domain agent prompts", () => {
    const plan = buildExecutionPlan("Backend Team", "add endpoint");
    expect(plan).not.toBeNull();
    const srStep = plan!.steps.find((s) => s.agentId === "sr-backend");
    expect(srStep).toBeDefined();
    expect(srStep!.systemPrompt).toContain("Senior Backend Engineer");
    expect(srStep!.systemPrompt).toContain("Domain expertise");
    expect(srStep!.systemPrompt).toContain("add endpoint");
  });
});

describe("autoAllocate", () => {
  it("allocates 1 dev for simple task", () => {
    const result = autoAllocate("fix typo", { fileCount: 1, domains: ["backend"], complexity: "low" });
    expect(result.developerCount).toBe(1);
    expect(result.structure).toBe("squad");
  });

  it("allocates 2 devs for fullstack task", () => {
    const result = autoAllocate("add login page", { fileCount: 4, domains: ["backend", "frontend"], complexity: "medium" });
    expect(result.developerCount).toBe(2);
  });

  it("allocates 3+ devs for complex multi-domain", () => {
    const result = autoAllocate("build AI feature", { fileCount: 8, domains: ["backend", "ai", "frontend"], complexity: "high" });
    expect(result.developerCount).toBeGreaterThanOrEqual(3);
  });

  it("allocates 4 devs for enterprise scale", () => {
    const result = autoAllocate("redesign system", { fileCount: 15, domains: ["backend", "frontend", "infra", "security"], complexity: "high" });
    expect(result.developerCount).toBe(4);
    expect(result.structure).toBe("hierarchy");
  });

  it("caps at 4 devs", () => {
    const result = autoAllocate("everything", { fileCount: 100, domains: ["a", "b", "c", "d", "e"], complexity: "high" });
    expect(result.developerCount).toBe(4);
  });
});

describe("formatPlan", () => {
  it("formats hierarchy plan with markers", () => {
    const plan = buildExecutionPlan("Full Team", "refactor auth")!;
    const output = formatPlan(plan);
    expect(output).toContain("hierarchy");
    expect(output).toContain("Full Team");
    expect(output).toContain("refactor auth");
    expect(output).toContain("Feedback loop");
  });

  it("formats squad plan with parallel markers", () => {
    const plan = buildExecutionPlan("Feature Squad", "add feature")!;
    const output = formatPlan(plan);
    expect(output).toContain("squad");
    expect(output).toContain("Feature Squad");
  });
});
