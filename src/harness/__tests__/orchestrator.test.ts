import { describe, it, expect } from "vitest";
import { buildExecutionPlan, autoAllocate, formatPlan, classifyWeight, classifyIntent } from "../orchestrator.js";

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

describe("classifyWeight", () => {
  it("passthrough for git commands", () => {
    expect(classifyWeight("git commit -m 'fix'")).toBe("passthrough");
    expect(classifyWeight("git push")).toBe("passthrough");
    expect(classifyWeight("git status")).toBe("passthrough");
  });

  it("passthrough for shell commands", () => {
    expect(classifyWeight("npm install")).toBe("passthrough");
    expect(classifyWeight("ls -la")).toBe("passthrough");
    expect(classifyWeight("node server.js")).toBe("passthrough");
  });

  it("passthrough for simple answers", () => {
    expect(classifyWeight("yes")).toBe("passthrough");
    expect(classifyWeight("ok")).toBe("passthrough");
    expect(classifyWeight("thanks")).toBe("passthrough");
  });

  it("passthrough for slash/dot commands", () => {
    expect(classifyWeight("/help")).toBe("passthrough");
    expect(classifyWeight("./review")).toBe("passthrough");
  });

  it("solo for simple fixes", () => {
    expect(classifyWeight("fix the typo in header")).toBe("solo");
    expect(classifyWeight("rename the variable")).toBe("solo");
    expect(classifyWeight("update the version")).toBe("solo");
    expect(classifyWeight("format the code")).toBe("solo");
  });

  it("pair for regular tasks", () => {
    expect(classifyWeight("add user authentication with OAuth2")).toBe("pair");
    expect(classifyWeight("build a dashboard component")).toBe("pair");
  });
});

describe("autoAllocate", () => {
  it("passthrough for git commands", () => {
    const result = autoAllocate("git push", {});
    expect(result.mode).toBe("passthrough");
    expect(result.developerCount).toBe(0);
  });

  it("solo for simple fix", () => {
    const result = autoAllocate("fix typo in header", {});
    expect(result.mode).toBe("solo");
    expect(result.developerCount).toBe(1);
  });

  it("allocates 2 devs for fullstack task", () => {
    const result = autoAllocate("add login page", { fileCount: 4, domains: ["backend", "frontend"], complexity: "medium" });
    expect(result.developerCount).toBe(2);
    expect(result.mode).toBe("pair");
  });

  it("allocates 3+ devs for complex multi-domain", () => {
    const result = autoAllocate("build AI feature", { fileCount: 8, domains: ["backend", "ai", "frontend"], complexity: "high" });
    expect(result.developerCount).toBeGreaterThanOrEqual(3);
  });

  it("allocates 4 devs for enterprise scale", () => {
    const result = autoAllocate("redesign system", { fileCount: 15, domains: ["backend", "frontend", "infra", "security"], complexity: "high" });
    expect(result.developerCount).toBe(4);
    expect(result.mode).toBe("hierarchy");
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

describe("classifyIntent", () => {
  it("pipe-separated tasks → trio, 3 tasks", () => {
    const result = classifyIntent("implement auth API | add tests | update docs");
    expect(result.mode).toBe("trio");
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0]).toBe("implement auth API");
    expect(result.tasks[1]).toBe("add tests");
    expect(result.tasks[2]).toBe("update docs");
    expect(result.reasoning).toBeTruthy();
    expect(result.confidence).toBe("high");
  });

  it("simple typo fix → solo, 1 task", () => {
    const result = classifyIntent("fix the typo");
    expect(result.mode).toBe("solo");
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toBe("fix the typo");
    expect(result.confidence).toBe("high");
  });

  it("git push → passthrough", () => {
    const result = classifyIntent("git push");
    expect(result.mode).toBe("passthrough");
    expect(result.suggestedAgents).toHaveLength(0);
    expect(result.confidence).toBe("high");
  });

  it("complex refactor → hierarchy", () => {
    const result = classifyIntent("refactor auth module to support OAuth2");
    expect(result.mode).toBe("hierarchy");
    expect(result.tasks).toHaveLength(1);
    expect(result.reasoning).toMatch(/complex|hierarchy/i);
  });

  it("add dark mode toggle → pair or solo", () => {
    const result = classifyIntent("add dark mode toggle");
    expect(["pair", "solo"]).toContain(result.mode);
    expect(result.tasks).toHaveLength(1);
  });

  it("result always has reasoning string", () => {
    for (const task of ["git pull", "fix the typo", "build new dashboard", "implement auth API | add tests | update docs"]) {
      const result = classifyIntent(task);
      expect(typeof result.reasoning).toBe("string");
      expect(result.reasoning.length).toBeGreaterThan(0);
    }
  });

  it("and then separator splits tasks", () => {
    const result = classifyIntent("add login endpoint and then write unit tests");
    expect(result.tasks).toHaveLength(2);
    expect(result.mode).toBe("pair");
  });

  it("suggestedAgents populated for non-passthrough", () => {
    const result = classifyIntent("implement auth API | add tests | update docs");
    expect(result.suggestedAgents.length).toBeGreaterThan(0);
  });

  it("exposes confidenceScore and signals for telemetry", () => {
    const result = classifyIntent("refactor the authentication middleware across backend and frontend");
    expect(typeof result.confidenceScore).toBe("number");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(100);
    expect(result.signals).toBeDefined();
    expect(Array.isArray(result.signals.domains)).toBe(true);
    expect(typeof result.signals.taskCount).toBe("number");
    expect(result.signals.complexitySignals).toContain("refactor");
  });

  it("passthrough earns top confidence score", () => {
    const result = classifyIntent("git status");
    expect(result.mode).toBe("passthrough");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it("vague single-domain fallback earns lower score than complex multi-domain", () => {
    const vague = classifyIntent("do something");
    const rich = classifyIntent("refactor authentication across backend and infra");
    expect(rich.confidenceScore).toBeGreaterThan(vague.confidenceScore);
  });
});
