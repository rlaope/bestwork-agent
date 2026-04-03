import { describe, it, expect } from "vitest";
import { validateConfig, formatConfigErrors } from "../config-validator.js";

describe("validateConfig", () => {
  it("returns empty array for valid empty config", () => {
    expect(validateConfig({})).toEqual([]);
  });

  it("returns empty array for null/undefined input", () => {
    expect(validateConfig(null)).toEqual([]);
    expect(validateConfig(undefined)).toEqual([]);
  });

  it("returns empty array for non-object input", () => {
    expect(validateConfig("string")).toEqual([]);
    expect(validateConfig(42)).toEqual([]);
  });

  // --- notify.discord ---
  it("accepts valid discord webhook URL", () => {
    const config = { notify: { discord: { webhookUrl: "https://discord.com/api/webhooks/123/abc" } } };
    expect(validateConfig(config)).toEqual([]);
  });

  it("rejects invalid discord webhook URL", () => {
    const config = { notify: { discord: { webhookUrl: "https://evil.com/webhook" } } };
    const errors = validateConfig(config);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("notify.discord.webhookUrl");
  });

  it("accepts empty discord webhook URL (not yet configured)", () => {
    const config = { notify: { discord: { webhookUrl: "" } } };
    expect(validateConfig(config)).toEqual([]);
  });

  // --- notify.slack ---
  it("accepts valid slack webhook URL", () => {
    const config = { notify: { slack: { webhookUrl: "https://hooks.slack.com/services/T/B/X" } } };
    expect(validateConfig(config)).toEqual([]);
  });

  it("rejects invalid slack webhook URL", () => {
    const config = { notify: { slack: { webhookUrl: "https://evil.com/hook" } } };
    const errors = validateConfig(config);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("notify.slack.webhookUrl");
  });

  // --- notify.telegram ---
  it("accepts valid telegram config", () => {
    const config = { notify: { telegram: { botToken: "123:ABC", chatId: "456" } } };
    expect(validateConfig(config)).toEqual([]);
  });

  it("rejects non-string telegram botToken", () => {
    const config = { notify: { telegram: { botToken: 123, chatId: "456" } } };
    const errors = validateConfig(config);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("notify.telegram.botToken");
  });

  // --- notify type checks ---
  it("rejects non-object notify", () => {
    const errors = validateConfig({ notify: "bad" });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("notify");
  });

  it("rejects non-object discord", () => {
    const errors = validateConfig({ notify: { discord: "bad" } });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("notify.discord");
  });

  it("rejects non-string discord webhookUrl", () => {
    const errors = validateConfig({ notify: { discord: { webhookUrl: 123 } } });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("notify.discord.webhookUrl");
  });

  // --- defaultMode ---
  it("accepts valid defaultMode", () => {
    for (const mode of ["solo", "pair", "trio", "squad", "hierarchy"]) {
      expect(validateConfig({ defaultMode: mode })).toEqual([]);
    }
  });

  it("rejects invalid defaultMode", () => {
    const errors = validateConfig({ defaultMode: "yolo" });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("defaultMode");
    expect(errors[0].message).toContain("yolo");
  });

  // --- preferredAgents ---
  it("accepts valid preferredAgents array", () => {
    expect(validateConfig({ preferredAgents: ["sr-backend", "sr-frontend"] })).toEqual([]);
  });

  it("rejects non-array preferredAgents", () => {
    const errors = validateConfig({ preferredAgents: "sr-backend" });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("preferredAgents");
  });

  it("rejects non-string items in preferredAgents", () => {
    const errors = validateConfig({ preferredAgents: ["ok", 42] });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("preferredAgents[1]");
  });

  // --- disabledAgents ---
  it("accepts valid disabledAgents array", () => {
    expect(validateConfig({ disabledAgents: ["jr-frontend"] })).toEqual([]);
  });

  it("rejects non-array disabledAgents", () => {
    const errors = validateConfig({ disabledAgents: {} });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("disabledAgents");
  });

  // --- testCommand / buildCommand ---
  it("accepts string testCommand and buildCommand", () => {
    expect(validateConfig({ testCommand: "npm test", buildCommand: "npm run build" })).toEqual([]);
  });

  it("rejects non-string testCommand", () => {
    const errors = validateConfig({ testCommand: 123 });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("testCommand");
  });

  it("rejects non-string buildCommand", () => {
    const errors = validateConfig({ buildCommand: true });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("buildCommand");
  });

  // --- nested project section ---
  it("validates nested project section", () => {
    const config = {
      notify: { discord: { webhookUrl: "https://discord.com/api/webhooks/123/abc" } },
      project: {
        defaultMode: "invalid",
        preferredAgents: "not-array",
      },
    };
    const errors = validateConfig(config);
    expect(errors).toHaveLength(2);
    expect(errors[0].field).toBe("project.defaultMode");
    expect(errors[1].field).toBe("project.preferredAgents");
  });

  it("rejects non-object project section", () => {
    const errors = validateConfig({ project: "bad" });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("project");
  });

  // --- multiple errors ---
  it("collects multiple errors from different sections", () => {
    const config = {
      notify: { discord: { webhookUrl: "http://bad" } },
      defaultMode: "invalid",
      disabledAgents: "not-array",
    };
    const errors = validateConfig(config);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  // --- full valid config ---
  it("passes a fully valid config", () => {
    const config = {
      notify: {
        discord: { webhookUrl: "https://discord.com/api/webhooks/123/abc" },
        slack: { webhookUrl: "https://hooks.slack.com/services/T/B/X" },
        telegram: { botToken: "123:ABC", chatId: "456" },
      },
      project: {
        defaultMode: "trio",
        preferredAgents: ["sr-backend", "sr-frontend"],
        disabledAgents: ["jr-frontend"],
        testCommand: "npm test",
        buildCommand: "npm run build",
      },
    };
    expect(validateConfig(config)).toEqual([]);
  });
});

describe("formatConfigErrors", () => {
  it("formats errors as indented lines", () => {
    const errors = [
      { field: "foo", message: "bad" },
      { field: "bar", message: "wrong" },
    ];
    const result = formatConfigErrors(errors);
    expect(result).toBe("  - foo: bad\n  - bar: wrong");
  });

  it("returns empty string for no errors", () => {
    expect(formatConfigErrors([])).toBe("");
  });
});
