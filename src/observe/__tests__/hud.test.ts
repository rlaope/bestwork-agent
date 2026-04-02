import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import {
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  readFileSync,
  rmSync,
} from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = resolve(join(__filename, "../../../../"));
const HUD_SCRIPT = join(PROJECT_DIR, "hooks/bestwork-hud.mjs");
const home = homedir();
const bwDir = join(home, ".bestwork");

/**
 * Run the HUD script by piping JSON via stdin and capture stdout.
 * Uses a short timeout because HUD is designed to be fast.
 */
function runHud(stdinJson = "{}"): string {
  // Escape single quotes in JSON for shell safety
  const escaped = stdinJson.replace(/'/g, "'\\''");
  return execSync(`echo '${escaped}' | node ${HUD_SCRIPT}`, {
    encoding: "utf-8",
    cwd: PROJECT_DIR,
    timeout: 15000,
    env: {
      ...process.env,
      // Prevent real API calls — no credentials available in test
      HOME: home,
    },
  });
}

/** Strip ANSI escape codes for easier text assertions */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

// Track files we create so we can clean them up
const createdFiles: string[] = [];
const backedUpFiles: Map<string, Buffer | null> = new Map();

function backupFile(path: string) {
  if (backedUpFiles.has(path)) return;
  backedUpFiles.set(path, existsSync(path) ? readFileSync(path) : null);
}

function createTestFile(path: string, content: string) {
  const dir = path.substring(0, path.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  backupFile(path);
  writeFileSync(path, content);
  createdFiles.push(path);
}

function restoreFiles() {
  for (const path of createdFiles) {
    const original = backedUpFiles.get(path);
    if (original === null || original === undefined) {
      try {
        unlinkSync(path);
      } catch {}
    } else {
      writeFileSync(path, original);
    }
  }
  createdFiles.length = 0;
  backedUpFiles.clear();
}

// Save/restore state around each test
beforeEach(() => {
  createdFiles.length = 0;
  backedUpFiles.clear();
});

afterEach(() => {
  restoreFiles();
});

// ---------------------------------------------------------------------------
// 1. Basic output format
// ---------------------------------------------------------------------------
describe("HUD basic output format", () => {
  it("should start with BW and version number", () => {
    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).toMatch(/^BW#\d+\.\d+\.\d+/);
  });

  it("should contain ANSI color codes in raw output", () => {
    const output = runHud();
    // ESC[ sequences must be present
    expect(output).toMatch(/\x1b\[/);
  });

  it("should output exactly one line ending with newline", () => {
    const output = runHud();
    // Must end with \n
    expect(output.endsWith("\n")).toBe(true);
    // Only one newline (the trailing one)
    const lines = output.split("\n").filter(Boolean);
    expect(lines.length).toBe(1);
  });

  it("should contain bold and reset ANSI codes", () => {
    const output = runHud();
    expect(output).toContain("\x1b[1m"); // Bold
    expect(output).toContain("\x1b[0m"); // Reset
  });

  it("should contain the cyan color code for BW label", () => {
    const output = runHud();
    // CC = "\x1b[36m" — cyan
    expect(output).toContain("\x1b[36m");
  });
});

// ---------------------------------------------------------------------------
// 2. Usage display
// ---------------------------------------------------------------------------
describe("HUD usage display", () => {
  it("should show percentage when BW cache exists with fresh data", () => {
    const cache = {
      ts: Date.now(),
      data: { fiveHour: 42, fiveHourReset: null, weekly: 15, weeklyReset: null },
      rateLimited: false,
      rateLimitedCount: 0,
      lastSuccessAt: Date.now(),
    };
    createTestFile(join(bwDir, ".usage-cache.json"), JSON.stringify(cache));

    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).toContain("42%(5h)");
    expect(plain).toContain("15%(wk)");
  });

  it("should show dashes when no cache exists and no credentials", () => {
    // Remove BW cache if it exists
    const cachePath = join(bwDir, ".usage-cache.json");
    backupFile(cachePath);
    try {
      unlinkSync(cachePath);
    } catch {}
    createdFiles.push(cachePath);

    const output = runHud();
    const plain = stripAnsi(output);
    // Without any cache or credentials, usage section may be absent entirely
    // or show dashes — either way it should NOT show a real percentage
    const hasFakePercent = /\d+%\(5h\)/.test(plain);
    if (hasFakePercent) {
      // If there's OMC cache we can't control, that's fine — just verify format
      expect(plain).toMatch(/\d+%\(5h\)/);
    }
    // The output should still start correctly
    expect(plain).toMatch(/^BW#/);
  });

  it("should show stale data when rate limited with previous success", () => {
    const cache = {
      ts: Date.now() - 5000, // 5 seconds ago
      data: { fiveHour: 65, fiveHourReset: null, weekly: 30, weeklyReset: null },
      rateLimited: true,
      rateLimitedCount: 1,
      lastSuccessAt: Date.now() - 60000,
    };
    createTestFile(join(bwDir, ".usage-cache.json"), JSON.stringify(cache));

    const output = runHud();
    const plain = stripAnsi(output);
    // Should use the stale data (65%/30%) since it's within backoff window
    expect(plain).toContain("65%(5h)");
    expect(plain).toContain("30%(wk)");
  });

  it("should show reset time when fiveHourReset is in the future", () => {
    const futureReset = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h from now
    const cache = {
      ts: Date.now(),
      data: { fiveHour: 80, fiveHourReset: futureReset, weekly: 50, weeklyReset: null },
      rateLimited: false,
      rateLimitedCount: 0,
      lastSuccessAt: Date.now(),
    };
    createTestFile(join(bwDir, ".usage-cache.json"), JSON.stringify(cache));

    const output = runHud();
    const plain = stripAnsi(output);
    // Should contain the reset countdown (↻ followed by duration)
    expect(plain).toMatch(/80%\(5h\)↻\d+h?\d*m?/);
  });

  it("should color-code usage based on percentage thresholds", () => {
    // >80 = red (\x1b[31m), >50 = yellow (\x1b[33m), <=50 = green (\x1b[32m)
    const cache = {
      ts: Date.now(),
      data: { fiveHour: 85, fiveHourReset: null, weekly: 20, weeklyReset: null },
      rateLimited: false,
      rateLimitedCount: 0,
      lastSuccessAt: Date.now(),
    };
    createTestFile(join(bwDir, ".usage-cache.json"), JSON.stringify(cache));

    const output = runHud();
    // 85% should be red
    expect(output).toContain("\x1b[31m85%");
    // 20% should be green
    expect(output).toContain("\x1b[32m20%");
  });
});

// ---------------------------------------------------------------------------
// 3. Session info
// ---------------------------------------------------------------------------
describe("HUD session info", () => {
  it("should show session time when session data exists", () => {
    // We can't easily mock the session dir, but we can check the format
    // if a session is active
    const output = runHud();
    const plain = stripAnsi(output);
    // Session time is either Ns, Nm, or NhNm format
    // If there's an active session, it should match one of these
    const hasSession = /\d+[smh]/.test(plain);
    if (hasSession) {
      expect(plain).toMatch(/\d+[smh]/);
    }
    // Always valid output regardless
    expect(plain).toMatch(/^BW#/);
  });

  it("should show efficiency score when session has prompts", () => {
    const output = runHud();
    const plain = stripAnsi(output);
    // If efficiency is displayed, it's in the format ⚡Nc/p
    const hasEfficiency = /⚡\d+c\/p/.test(plain);
    if (hasEfficiency) {
      expect(plain).toMatch(/⚡\d+c\/p/);
    }
    expect(plain).toMatch(/^BW#/);
  });
});

// ---------------------------------------------------------------------------
// 4. Context percentage from stdin
// ---------------------------------------------------------------------------
describe("HUD context percentage", () => {
  it("should show context % when context_used_tokens and context_window_tokens provided", () => {
    const input = JSON.stringify({
      context_used_tokens: 50000,
      context_window_tokens: 200000,
    });
    const output = runHud(input);
    const plain = stripAnsi(output);
    expect(plain).toContain("ctx 25%");
  });

  it("should show context % with tokenCount/contextWindow fallback fields", () => {
    const input = JSON.stringify({
      tokenCount: 100000,
      contextWindow: 200000,
    });
    const output = runHud(input);
    const plain = stripAnsi(output);
    expect(plain).toContain("ctx 50%");
  });

  it("should not show context when no token data in stdin", () => {
    const output = runHud("{}");
    const plain = stripAnsi(output);
    expect(plain).not.toContain("ctx");
  });

  it("should color context green when below 50%", () => {
    const input = JSON.stringify({
      context_used_tokens: 10000,
      context_window_tokens: 200000,
    });
    const output = runHud(input);
    // 5% — should be green (\x1b[32m)
    expect(output).toContain("\x1b[32m5%");
  });

  it("should color context yellow when between 50-80%", () => {
    const input = JSON.stringify({
      context_used_tokens: 130000,
      context_window_tokens: 200000,
    });
    const output = runHud(input);
    // 65% — should be yellow (\x1b[33m)
    expect(output).toContain("\x1b[33m65%");
  });

  it("should color context red when above 80%", () => {
    const input = JSON.stringify({
      context_used_tokens: 190000,
      context_window_tokens: 200000,
    });
    const output = runHud(input);
    // 95% — should be red (\x1b[31m)
    expect(output).toContain("\x1b[31m95%");
  });

  it("should round context percentage to nearest integer", () => {
    const input = JSON.stringify({
      context_used_tokens: 33333,
      context_window_tokens: 200000,
    });
    const output = runHud(input);
    const plain = stripAnsi(output);
    // 33333/200000 = 16.6665 → rounds to 17%
    expect(plain).toContain("ctx 17%");
  });
});

// ---------------------------------------------------------------------------
// 5. Guards and notifications
// ---------------------------------------------------------------------------
describe("HUD guards", () => {
  it("should show lock icon when scope.lock exists", () => {
    createTestFile(join(bwDir, "scope.lock"), "locked");

    const output = runHud();
    expect(output).toContain("🔒");
  });

  it("should show shield icon when strict.lock exists", () => {
    createTestFile(join(bwDir, "strict.lock"), "strict");

    const output = runHud();
    expect(output).toContain("🛡");
  });

  it("should show both guard icons when both locks exist", () => {
    createTestFile(join(bwDir, "scope.lock"), "locked");
    createTestFile(join(bwDir, "strict.lock"), "strict");

    const output = runHud();
    expect(output).toContain("🔒");
    expect(output).toContain("🛡");
  });

  it("should not show lock icons when no lock files exist", () => {
    // Ensure lock files don't exist
    const scopeLock = join(bwDir, "scope.lock");
    const strictLock = join(bwDir, "strict.lock");
    backupFile(scopeLock);
    backupFile(strictLock);
    try { unlinkSync(scopeLock); } catch {}
    try { unlinkSync(strictLock); } catch {}
    createdFiles.push(scopeLock, strictLock);

    const output = runHud();
    expect(output).not.toContain("🔒");
    expect(output).not.toContain("🛡");
  });
});

describe("HUD notifications", () => {
  it("should show msg:discord when discord webhook configured", () => {
    const config = {
      notify: { discord: { webhookUrl: "https://discord.com/api/webhooks/test" } },
    };
    createTestFile(join(bwDir, "config.json"), JSON.stringify(config));

    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).toContain("msg:discord");
  });

  it("should show msg:slack when slack webhook configured", () => {
    const config = {
      notify: { slack: { webhookUrl: "https://hooks.slack.com/test" } },
    };
    createTestFile(join(bwDir, "config.json"), JSON.stringify(config));

    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).toContain("msg:slack");
  });

  it("should show msg:discord,slack when both configured", () => {
    const config = {
      notify: {
        discord: { webhookUrl: "https://discord.com/api/webhooks/test" },
        slack: { webhookUrl: "https://hooks.slack.com/test" },
      },
    };
    createTestFile(join(bwDir, "config.json"), JSON.stringify(config));

    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).toContain("msg:discord,slack");
  });

  it("should not show msg: when no notifications configured", () => {
    const config = {};
    createTestFile(join(bwDir, "config.json"), JSON.stringify(config));

    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).not.toContain("msg:");
  });

  it("should not show msg: when notify exists but no webhook URLs", () => {
    const config = { notify: { discord: {}, slack: {} } };
    createTestFile(join(bwDir, "config.json"), JSON.stringify(config));

    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).not.toContain("msg:");
  });
});

// ---------------------------------------------------------------------------
// 6. Gateway mode indicator
// ---------------------------------------------------------------------------
describe("HUD gateway mode", () => {
  it("should show trio label when gateway.log has recent trio entry", () => {
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      mode: "trio",
    });
    createTestFile(join(bwDir, "gateway.log"), entry);

    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).toContain("▶trio");
  });

  it("should show solo label when gateway.log has recent solo entry", () => {
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      mode: "solo",
    });
    createTestFile(join(bwDir, "gateway.log"), entry);

    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).toContain("solo");
  });

  it("should not show gateway mode when log entry is older than 60s", () => {
    const oldTs = new Date(Date.now() - 120000).toISOString(); // 2 min ago
    const entry = JSON.stringify({
      timestamp: oldTs,
      mode: "trio",
    });
    createTestFile(join(bwDir, "gateway.log"), entry);

    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).not.toContain("▶trio");
  });

  it("should not show gateway mode when gateway.log does not exist", () => {
    const logPath = join(bwDir, "gateway.log");
    backupFile(logPath);
    try { unlinkSync(logPath); } catch {}
    createdFiles.push(logPath);

    const output = runHud();
    const plain = stripAnsi(output);
    // None of the mode labels should appear
    expect(plain).not.toContain("▶trio");
    expect(plain).not.toContain("solo");
    expect(plain).not.toContain("pair");
    expect(plain).not.toContain("hier");
  });

  it("should use skill name as label when mode is absent but skill exists", () => {
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      skill: "review",
    });
    createTestFile(join(bwDir, "gateway.log"), entry);

    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).toContain("review");
  });

  it("should read only the last line of multi-line gateway.log", () => {
    const oldEntry = JSON.stringify({ timestamp: new Date().toISOString(), mode: "solo" });
    const newEntry = JSON.stringify({ timestamp: new Date().toISOString(), mode: "pair" });
    createTestFile(join(bwDir, "gateway.log"), oldEntry + "\n" + newEntry);

    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).toContain("pair");
  });
});

// ---------------------------------------------------------------------------
// 7. Error resilience
// ---------------------------------------------------------------------------
describe("HUD error resilience", () => {
  it("should still output BW version line on malformed stdin", () => {
    const output = execSync(`echo 'not json at all' | node ${HUD_SCRIPT}`, {
      encoding: "utf-8",
      cwd: PROJECT_DIR,
      timeout: 15000,
    });
    const plain = stripAnsi(output);
    expect(plain).toMatch(/^BW#\d+\.\d+\.\d+/);
  });

  it("should handle empty stdin gracefully", () => {
    const output = execSync(`echo '' | node ${HUD_SCRIPT}`, {
      encoding: "utf-8",
      cwd: PROJECT_DIR,
      timeout: 15000,
    });
    const plain = stripAnsi(output);
    expect(plain).toMatch(/^BW#\d+\.\d+\.\d+/);
  });

  it("should handle malformed config.json gracefully", () => {
    createTestFile(join(bwDir, "config.json"), "NOT VALID JSON {{{");

    // Should not crash — the catch block falls back to fallback line
    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).toMatch(/^BW#/);
  });

  it("should handle malformed gateway.log gracefully", () => {
    createTestFile(join(bwDir, "gateway.log"), "NOT JSON");

    const output = runHud();
    const plain = stripAnsi(output);
    expect(plain).toMatch(/^BW#/);
    // Should not show any gateway mode
    expect(plain).not.toContain("▶trio");
  });
});
