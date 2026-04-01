import { describe, it, expect } from "vitest";
import {
  truncate,
  barChart,
  shortSessionId,
  formatNumber,
} from "../format.js";

describe("truncate", () => {
  it("returns string unchanged if within limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates with ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello w…");
  });
});

describe("barChart", () => {
  it("renders full bar for max value", () => {
    const bar = barChart(10, 10, 10);
    expect(bar).toBe("██████████");
  });

  it("renders half bar", () => {
    const bar = barChart(5, 10, 10);
    expect(bar).toBe("█████░░░░░");
  });

  it("renders empty bar for zero", () => {
    const bar = barChart(0, 10, 10);
    expect(bar).toBe("░░░░░░░░░░");
  });

  it("handles zero max", () => {
    const bar = barChart(0, 0, 10);
    expect(bar).toBe("░░░░░░░░░░");
  });
});

describe("shortSessionId", () => {
  it("takes first 8 characters", () => {
    expect(shortSessionId("abcdefgh-1234-5678")).toBe("abcdefgh");
  });
});

describe("formatNumber", () => {
  it("formats numbers", () => {
    expect(formatNumber(0)).toBe("0");
  });
});
