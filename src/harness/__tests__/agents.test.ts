import { describe, it, expect } from "vitest";
import { getAgentWithPrompt, getTeamWithPrompts, getAgent } from "../agents/index.js";

describe("getAgentWithPrompt", () => {
  it("returns null for unknown agent id", async () => {
    const result = await getAgentWithPrompt("nonexistent-agent");
    expect(result).toBeNull();
  });

  it("falls back to hardcoded prompt when prompts/ file is missing", async () => {
    // "pm-product" maps to role "pm", name "product" — no such file likely exists
    // If it does, it should still return an agent; if not, fallback to hardcoded
    const agent = getAgent("pm-product");
    expect(agent).toBeDefined();

    const result = await getAgentWithPrompt("pm-product");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("pm-product");
    // systemPrompt must be a non-empty string (either from file or hardcoded fallback)
    expect(typeof result!.systemPrompt).toBe("string");
    expect(result!.systemPrompt.length).toBeGreaterThan(0);
  });

  it("returns agent with same metadata when prompt file is missing", async () => {
    const original = getAgent("tech-backend");
    expect(original).toBeDefined();

    const result = await getAgentWithPrompt("tech-backend");
    expect(result).not.toBeNull();
    expect(result!.id).toBe(original!.id);
    expect(result!.role).toBe(original!.role);
    expect(result!.name).toBe(original!.name);
    expect(result!.specialty).toBe(original!.specialty);
  });
});

describe("getTeamWithPrompts", () => {
  it("returns empty array for empty input", async () => {
    const result = await getTeamWithPrompts([]);
    expect(result).toEqual([]);
  });

  it("filters out unknown agent ids", async () => {
    const result = await getTeamWithPrompts(["tech-backend", "nonexistent-agent"]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("tech-backend");
  });

  it("loads multiple agents in parallel", async () => {
    const result = await getTeamWithPrompts(["tech-backend", "tech-frontend"]);
    expect(result).toHaveLength(2);
    const ids = result.map((a) => a.id);
    expect(ids).toContain("tech-backend");
    expect(ids).toContain("tech-frontend");
  });
});
