import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseSessionStats, parseHistory, parseSessions } from "../claude-parser.js";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

import { readFile, readdir } from "node:fs/promises";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseSessionStats", () => {
  it("parses valid session stats", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        sessions: {
          "abc-123": {
            tool_counts: { Read: 5, Bash: 3 },
            last_tool: "Read",
            total_calls: 8,
            started_at: 1700000000000,
            updated_at: 1700001000000,
          },
        },
      })
    );

    const result = await parseSessionStats();
    expect(result.size).toBe(1);
    const stat = result.get("abc-123");
    expect(stat?.total_calls).toBe(8);
    expect(stat?.tool_counts.Read).toBe(5);
  });

  it("returns empty map when file is missing", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await parseSessionStats();
    expect(result.size).toBe(0);
  });
});

describe("parseHistory", () => {
  it("parses valid JSONL history", async () => {
    const lines = [
      JSON.stringify({
        display: "hello",
        timestamp: 1700000000000,
        project: "/test",
        sessionId: "abc",
      }),
      JSON.stringify({
        display: "world",
        timestamp: 1700000001000,
        project: "/test",
        sessionId: "abc",
      }),
    ].join("\n");

    mockReadFile.mockResolvedValue(lines);
    const result = await parseHistory();
    expect(result).toHaveLength(2);
    expect(result[0]?.display).toBe("hello");
    expect(result[1]?.sessionId).toBe("abc");
  });

  it("returns empty array when file is missing", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await parseHistory();
    expect(result).toHaveLength(0);
  });
});

describe("parseSessions", () => {
  it("parses session files", async () => {
    mockReaddir.mockResolvedValue(["s1.json", "s2.json"] as any);
    mockReadFile
      .mockResolvedValueOnce(
        JSON.stringify({
          pid: 1234,
          sessionId: "s1",
          cwd: "/home",
          startedAt: 1700000000000,
          kind: "interactive",
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          pid: 5678,
          sessionId: "s2",
          cwd: "/work",
          startedAt: 1700000001000,
          kind: "interactive",
        })
      );

    const result = await parseSessions();
    expect(result).toHaveLength(2);
    expect(result[0]?.pid).toBe(1234);
    expect(result[1]?.cwd).toBe("/work");
  });

  it("returns empty array when sessions dir missing", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    const result = await parseSessions();
    expect(result).toHaveLength(0);
  });
});
