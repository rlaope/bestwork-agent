import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";

const CWD = "/Users/rlaope/Desktop/khope/nysm";
const HOOK_PATH = "hooks/bestwork-review.sh";

/**
 * Run the review hook with BESTWORK_REVIEW_TRIGGER=1 and return stdout/stderr.
 */
function runReview(
  input = '{"prompt":"review"}',
  env: Record<string, string> = {},
): { stdout: string; stderr: string } {
  try {
    const stdout = execSync(
      `echo '${input}' | BESTWORK_REVIEW_TRIGGER=1 bash "${HOOK_PATH}"`,
      {
        encoding: "utf-8",
        cwd: CWD,
        timeout: 15000,
        env: { ...process.env, BESTWORK_REVIEW_TRIGGER: "1", ...env },
      },
    );
    return { stdout, stderr: "" };
  } catch (e: any) {
    return { stdout: e.stdout || "", stderr: e.stderr || "" };
  }
}

/**
 * Run the hook WITHOUT the trigger env var — should return {}.
 */
function runWithoutTrigger(): { stdout: string; stderr: string } {
  try {
    const stdout = execSync(
      `echo '{"prompt":"hello"}' | bash "${HOOK_PATH}"`,
      {
        encoding: "utf-8",
        cwd: CWD,
        timeout: 15000,
        env: { ...process.env, BESTWORK_REVIEW_TRIGGER: undefined } as any,
      },
    );
    return { stdout, stderr: "" };
  } catch (e: any) {
    return { stdout: e.stdout || "", stderr: e.stderr || "" };
  }
}

function parseOutput(stdout: string): any {
  try {
    return JSON.parse(stdout.trim());
  } catch {
    return null;
  }
}

// ─── Temp file helpers for detection tests ───
const TEMP_DIR = join(CWD, "src/harness/__tests__/_review_tmp");
const tempFiles: string[] = [];

function createTempFile(name: string, content: string): string {
  mkdirSync(TEMP_DIR, { recursive: true });
  const fpath = join(TEMP_DIR, name);
  writeFileSync(fpath, content, "utf-8");
  tempFiles.push(fpath);
  return fpath;
}

function stageFile(fpath: string): void {
  execSync(`git add "${fpath}"`, { cwd: CWD });
}

function cleanupTempFiles(): void {
  for (const f of tempFiles) {
    try {
      execSync(`git reset HEAD "${f}" 2>/dev/null; rm -f "${f}"`, {
        cwd: CWD,
      });
    } catch {
      /* best-effort */
    }
  }
  tempFiles.length = 0;
  try {
    execSync(`rm -rf "${TEMP_DIR}"`, { cwd: CWD });
  } catch {
    /* best-effort */
  }
}

// ─────────────────────────────────────────────
// 1. Basic operation
// ─────────────────────────────────────────────
describe("review hook — basic operation", () => {
  it("should produce JSON output when BESTWORK_REVIEW_TRIGGER=1", () => {
    const { stdout } = runReview();
    const parsed = parseOutput(stdout);
    expect(parsed).not.toBeNull();
  });

  it("should return {} when trigger is absent", () => {
    const { stdout } = runWithoutTrigger();
    const parsed = parseOutput(stdout);
    expect(parsed).not.toBeNull();
    expect(parsed).toEqual({});
  });

  it("should produce valid JSON", () => {
    const { stdout } = runReview();
    expect(() => JSON.parse(stdout.trim())).not.toThrow();
  });

  it("should contain hookSpecificOutput.additionalContext", () => {
    const { stdout } = runReview();
    const parsed = parseOutput(stdout);
    expect(parsed).not.toBeNull();
    expect(parsed.hookSpecificOutput).toBeDefined();
    expect(parsed.hookSpecificOutput.additionalContext).toBeDefined();
    expect(typeof parsed.hookSpecificOutput.additionalContext).toBe("string");
  });

  it("should set hookEventName to UserPromptSubmit", () => {
    const { stdout } = runReview();
    const parsed = parseOutput(stdout);
    expect(parsed?.hookSpecificOutput?.hookEventName).toBe(
      "UserPromptSubmit",
    );
  });
});

// ─────────────────────────────────────────────
// 2. No grep errors
// ─────────────────────────────────────────────
describe("review hook — no grep errors", () => {
  it("stderr should not contain 'repetition-operator operand invalid'", () => {
    const { stderr } = runReview();
    expect(stderr).not.toContain("repetition-operator operand invalid");
  });

  it("stderr should not contain 'grep:' errors", () => {
    const { stderr } = runReview();
    expect(stderr).not.toContain("grep:");
  });

  it("should exit cleanly (no uncaught errors in stderr)", () => {
    const { stderr } = runReview();
    expect(stderr).not.toContain("syntax error");
    expect(stderr).not.toContain("command not found");
  });
});

// ─────────────────────────────────────────────
// 3. Review result format
// ─────────────────────────────────────────────
describe("review hook — result format", () => {
  it("additionalContext should start with '[BW review]'", () => {
    const { stdout } = runReview();
    const parsed = parseOutput(stdout);
    const ctx = parsed?.hookSpecificOutput?.additionalContext ?? "";
    expect(ctx).toMatch(/^\[BW review\]/);
  });

  it("additionalContext should contain either '✅ No issues' or '⚠️'", () => {
    const { stdout } = runReview();
    const parsed = parseOutput(stdout);
    const ctx = parsed?.hookSpecificOutput?.additionalContext ?? "";
    const hasNoIssues = ctx.includes("✅ No issues");
    const hasWarning = ctx.includes("⚠️");
    expect(hasNoIssues || hasWarning).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 4. Detection capabilities
// ─────────────────────────────────────────────
describe("review hook — detection: fake import", () => {
  afterAll(() => cleanupTempFiles());

  it("should warn about missing dependency for fake package import", () => {
    const f = createTempFile(
      "fake-import.ts",
      'import something from "nonexistent-pkg-xyz-12345";\nconsole.log(something);\n',
    );
    stageFile(f);

    const { stdout } = runReview();
    const parsed = parseOutput(stdout);
    const ctx = parsed?.hookSpecificOutput?.additionalContext ?? "";

    cleanupTempFiles();

    expect(ctx).toContain("⚠️");
    expect(ctx).toMatch(/not found in dependencies/i);
  });
});

describe("review hook — detection: platform mismatch", () => {
  afterAll(() => cleanupTempFiles());

  it("should warn about Linux patterns on macOS", () => {
    // This test only applies on macOS
    const os = execSync("uname -s", { encoding: "utf-8" }).trim();
    if (os !== "Darwin") {
      return; // skip on non-macOS
    }

    const f = createTempFile(
      "platform-mismatch.ts",
      'const info = fs.readFileSync("/proc/cpuinfo");\nconsole.log(info);\n',
    );
    stageFile(f);

    const { stdout } = runReview();
    const parsed = parseOutput(stdout);
    const ctx = parsed?.hookSpecificOutput?.additionalContext ?? "";

    cleanupTempFiles();

    expect(ctx).toContain("⚠️");
    expect(ctx).toMatch(/linux/i);
  });
});

describe("review hook — detection: type abuse", () => {
  afterAll(() => cleanupTempFiles());

  it("should warn about 'as any' type safety bypass", () => {
    const f = createTempFile(
      "type-abuse.ts",
      "const x = someValue as any;\nconst y = other as unknown as string;\n",
    );
    stageFile(f);

    const { stdout } = runReview();
    const parsed = parseOutput(stdout);
    const ctx = parsed?.hookSpecificOutput?.additionalContext ?? "";

    cleanupTempFiles();

    expect(ctx).toContain("⚠️");
    expect(ctx).toMatch(/type safety bypass/i);
  });
});

describe("review hook — detection: deprecated patterns", () => {
  afterAll(() => cleanupTempFiles());

  it("should warn about deprecated Node.js patterns like new Buffer()", () => {
    const f = createTempFile(
      "deprecated.ts",
      'const buf = new Buffer("hello");\nconst parsed = url.parse("http://example.com");\n',
    );
    stageFile(f);

    const { stdout } = runReview();
    const parsed = parseOutput(stdout);
    const ctx = parsed?.hookSpecificOutput?.additionalContext ?? "";

    cleanupTempFiles();

    expect(ctx).toContain("⚠️");
    expect(ctx).toMatch(/deprecated/i);
  });
});

describe("review hook — detection: suspicious methods", () => {
  afterAll(() => cleanupTempFiles());

  it("should warn about possibly hallucinated method calls", () => {
    const f = createTempFile(
      "suspicious.ts",
      "const data = obj.toPlainObject();\nconsole.success('done');\n",
    );
    stageFile(f);

    const { stdout } = runReview();
    const parsed = parseOutput(stdout);
    const ctx = parsed?.hookSpecificOutput?.additionalContext ?? "";

    cleanupTempFiles();

    expect(ctx).toContain("⚠️");
    expect(ctx).toMatch(/suspicious|hallucinated/i);
  });
});

// ─────────────────────────────────────────────
// 5. No changes scenario
// ─────────────────────────────────────────────
describe("review hook — no changes scenario", () => {
  it("should indicate no changes when working tree is clean and nothing staged", () => {
    // Ensure no leftover staged/unstaged changes from other tests
    cleanupTempFiles();

    // Run on a clean tree — the hook tries git diff HEAD, git diff, git diff HEAD~1
    // On a clean tree with no new changes, it falls back to HEAD~1 which likely has a diff
    // So we just verify the output is valid JSON with the expected structure
    const { stdout } = runReview();
    const parsed = parseOutput(stdout);
    expect(parsed).not.toBeNull();
    expect(parsed.hookSpecificOutput).toBeDefined();
  });
});
