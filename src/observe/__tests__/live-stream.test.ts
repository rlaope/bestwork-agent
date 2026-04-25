import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { LiveSessionStream, type HealthSnapshot } from "../live-stream.js";

/**
 * The stream resolves files at $HOME/.bestwork/data — for tests we point HOME
 * at a tmp dir so we can stage files without touching the real session log.
 */
function setupTmpHome() {
  const tmp = mkdtempSync(join(tmpdir(), "bw-livestream-"));
  mkdirSync(join(tmp, ".bestwork", "data"), { recursive: true });
  const originalHome = process.env.HOME;
  process.env.HOME = tmp;
  return {
    tmp,
    restore: () => {
      if (originalHome === undefined) delete process.env.HOME;
      else process.env.HOME = originalHome;
      rmSync(tmp, { recursive: true, force: true });
    },
  };
}

function writeJsonl(path: string, events: object[]) {
  writeFileSync(path, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

describe("LiveSessionStream", () => {
  it("emits idle snapshot when session file is missing", () => {
    const { tmp, restore } = setupTmpHome();
    try {
      const stream = new LiveSessionStream();
      let captured: HealthSnapshot | null = null;
      stream.on("snapshot", (s) => (captured = s));
      stream.start("nonexistent");
      stream.stop();
      expect(captured).not.toBeNull();
      expect(captured!.verdict).toBe("idle");
      expect(captured!.totalEvents).toBe(0);
      expect(captured!.callsPerMinute).toBe(0);
    } finally {
      restore();
    }
  });

  it("parses initial file content and reports active verdict on recent events", () => {
    const { restore } = setupTmpHome();
    try {
      const sessionId = "abc123";
      const file = join(homedir(), ".bestwork", "data", `${sessionId}.jsonl`);
      const now = Date.now();
      writeJsonl(file, [
        { timestamp: now - 1000, sessionId, toolName: "Edit", event: "post", input: { file_path: "src/a.ts" } },
        { timestamp: now - 500, sessionId, toolName: "Bash", event: "post", input: { command: "npm test" } },
        { timestamp: now, sessionId, toolName: "Read", event: "post", input: { file_path: "src/b.ts" } },
      ]);

      const stream = new LiveSessionStream();
      stream.start(sessionId);
      const snap = stream.computeSnapshot();
      stream.stop();

      expect(snap.totalEvents).toBe(3);
      expect(snap.callsPerMinute).toBe(3);
      expect(snap.verdict).toBe("active");
      expect(snap.topTool).not.toBeNull();
    } finally {
      restore();
    }
  });

  it("detects a looping verdict when the same tool+file repeats", () => {
    const { restore } = setupTmpHome();
    try {
      const sessionId = "loopsess";
      const file = join(homedir(), ".bestwork", "data", `${sessionId}.jsonl`);
      const now = Date.now();
      const events = [];
      // 5 Edit events on the same file inside the loop window
      for (let i = 0; i < 5; i++) {
        events.push({
          timestamp: now - (5 - i) * 1000,
          sessionId,
          toolName: "Edit",
          event: "post",
          input: { file_path: "src/auth.ts" },
        });
      }
      writeJsonl(file, events);

      const stream = new LiveSessionStream();
      stream.start(sessionId);
      const snap = stream.computeSnapshot();
      stream.stop();

      expect(snap.loopHint).not.toBeNull();
      expect(snap.loopHint!.tool).toBe("Edit");
      expect(snap.loopHint!.target).toBe("src/auth.ts");
      expect(snap.loopHint!.hits).toBeGreaterThanOrEqual(4);
      expect(snap.verdict).toBe("looping");
    } finally {
      restore();
    }
  });

  it("rejects malformed sessionIds via path traversal guard", () => {
    const { restore } = setupTmpHome();
    try {
      const stream = new LiveSessionStream();
      expect(() => stream.start("../../../etc/passwd")).not.toThrow();
      // After sanitization the safe id is "etcpasswd" (no slashes), file
      // shouldn't exist, so we expect an idle snapshot instead of a crash.
      const snap = stream.computeSnapshot();
      stream.stop();
      expect(snap.verdict).toBe("idle");
    } finally {
      restore();
    }
  });
});
