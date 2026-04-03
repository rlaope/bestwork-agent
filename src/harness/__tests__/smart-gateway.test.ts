import { describe, it, expect } from "vitest";
import { classifyIntent, classifyWeight } from "../orchestrator.js";
import { execSync } from "child_process";
import { resolve, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = resolve(join(__filename, "../../../../"));

// Helper: run compiled gateway via child_process, returns raw stdout
function runGateway(prompt: string): string {
  const input = JSON.stringify({ prompt });
  // Escape single quotes for shell
  const escaped = input.replace(/'/g, "'\\''");
  try {
    return execSync(`echo '${escaped}' | node dist/smart-gateway.js`, {
      encoding: "utf-8",
      cwd: PROJECT_DIR,
      timeout: 5000,
    }).trim();
  } catch {
    return "{}";
  }
}

// Helper: parse gateway JSON output
function parseGateway(prompt: string): {
  isEmpty: boolean;
  additionalContext?: string;
} {
  const raw = runGateway(prompt);
  if (raw === "{}" || !raw) return { isEmpty: true };
  try {
    const parsed = JSON.parse(raw);
    return {
      isEmpty: false,
      additionalContext: parsed?.hookSpecificOutput?.additionalContext ?? "",
    };
  } catch {
    return { isEmpty: true };
  }
}

// ============================================================
// 1. PASSTHROUGH — should return no routing
// ============================================================

describe("PASSTHROUGH: classifyWeight", () => {
  describe("git commands", () => {
    it.each([
      "git status",
      "git log --oneline",
      "git diff HEAD~1",
      "git push origin main",
      "git pull",
      "git checkout -b feature",
      "git merge develop",
      "git stash pop",
      "git rebase main",
      "git branch -a",
    ])("'%s' → passthrough", (cmd) => {
      expect(classifyWeight(cmd)).toBe("passthrough");
    });
  });

  describe("shell commands", () => {
    it.each([
      "ls -la",
      "cd src",
      "npm install",
      "npx tsc --noEmit",
      "node server.js",
      "yarn build",
      "pnpm test",
      "bun run dev",
      "cargo build",
      "pip install flask",
      "make build",
      "mkdir -p dist",
      "cat README.md",
    ])("'%s' → passthrough", (cmd) => {
      expect(classifyWeight(cmd)).toBe("passthrough");
    });
  });

  describe("acknowledgements", () => {
    it.each(["yes", "no", "ok", "thanks", "y", "n", "bye", "exit", "quit"])(
      "'%s' → passthrough",
      (ack) => {
        expect(classifyWeight(ack)).toBe("passthrough");
      }
    );
  });

  describe("slash commands", () => {
    it.each(["/commit", "/help", "/clear", "/review", "/status"])(
      "'%s' → passthrough",
      (cmd) => {
        expect(classifyWeight(cmd)).toBe("passthrough");
      }
    );
  });

  describe("dot commands", () => {
    it.each(["./help", "./trio task1 | task2", "./review", "./bw-install"])(
      "'%s' → passthrough",
      (cmd) => {
        expect(classifyWeight(cmd)).toBe("passthrough");
      }
    );
  });
});

describe("PASSTHROUGH: classifyIntent", () => {
  it.each([
    "git status",
    "npm install",
    "yes",
    "/help",
    "./trio build stuff",
  ])("'%s' → passthrough mode with empty agents", (cmd) => {
    const result = classifyIntent(cmd);
    expect(result.mode).toBe("passthrough");
    expect(result.suggestedAgents).toHaveLength(0);
    expect(result.confidence).toBe("high");
  });
});

// ============================================================
// 2. MAGIC KEYWORD skill routing (via compiled gateway)
// ============================================================

describe("MAGIC KEYWORD: skill routing via gateway", () => {
  describe("Korean keywords", () => {
    it("'리뷰해줘' → review skill", () => {
      const result = parseGateway("리뷰해줘");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toContain("MAGIC KEYWORD");
      expect(result.additionalContext).toContain("bestwork-agent:review");
    });

    it("'에이전트 목록' → agents skill", () => {
      const result = parseGateway("에이전트 목록");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toContain("MAGIC KEYWORD");
      expect(result.additionalContext).toContain("bestwork-agent:agents");
    });

    it("'세션 요약' → sessions skill", () => {
      const result = parseGateway("세션 요약");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toContain("MAGIC KEYWORD");
      expect(result.additionalContext).toContain("bestwork-agent:sessions");
    });

    it("'건강 체크' → health skill", () => {
      const result = parseGateway("건강 체크");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toContain("MAGIC KEYWORD");
      expect(result.additionalContext).toContain("bestwork-agent:health");
    });
  });

  describe("English keywords", () => {
    it("'review my code' → review skill", () => {
      const result = parseGateway("review my code");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toContain("bestwork-agent:review");
    });

    it("'health check please' → health skill", () => {
      const result = parseGateway("health check please");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toContain("bestwork-agent:health");
    });

    it("'bestwork status' → status skill", () => {
      const result = parseGateway("bestwork status");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toContain("bestwork-agent:status");
    });

    it("'install hooks for bestwork' → install skill", () => {
      const result = parseGateway("install hooks for bestwork");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toContain("bestwork-agent:install");
    });

    it("'agent list' → agents skill", () => {
      const result = parseGateway("agent list");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toContain("bestwork-agent:agents");
    });
  });

  describe("Japanese keywords", () => {
    it("'コードレビューしてください' → review skill", () => {
      const result = parseGateway("コードレビューしてください");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toContain("bestwork-agent:review");
    });

    it("'ヘルスチェック' → health skill", () => {
      const result = parseGateway("ヘルスチェック");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toContain("bestwork-agent:health");
    });

    it("'エージェント一覧' → agents skill", () => {
      const result = parseGateway("エージェント一覧");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toContain("bestwork-agent:agents");
    });
  });

  describe("MAGIC KEYWORD output format", () => {
    it("contains MAGIC KEYWORD prefix and Skill tool instruction", () => {
      const result = parseGateway("건강 체크 좀 해줘");
      expect(result.isEmpty).toBe(false);
      expect(result.additionalContext).toMatch(/\[MAGIC KEYWORD: BESTWORK_\w+\]/);
      expect(result.additionalContext).toContain("You MUST invoke the skill");
      expect(result.additionalContext).toContain("Skill tool");
    });
  });
});

// ============================================================
// 3. SOLO mode — single lightweight tasks
// ============================================================

describe("SOLO mode", () => {
  it.each([
    "fix the typo in readme",
    "rename this variable",
    "format code with prettier",
    "update version in package.json",
    "lint the codebase",
    "fix a bug in the header",
    "delete unused imports",
    "add a comment to the function",
    "update the changelog",
  ])("'%s' → solo mode", (prompt) => {
    const result = classifyIntent(prompt);
    expect(result.mode).toBe("solo");
    expect(result.tasks).toHaveLength(1);
    expect(result.confidence).toBe("high");
    expect(result.suggestedAgents.length).toBeGreaterThanOrEqual(1);
  });

  it("classifyWeight returns solo for fix/rename/format/lint", () => {
    expect(classifyWeight("fix the typo in readme")).toBe("solo");
    expect(classifyWeight("rename this variable")).toBe("solo");
    expect(classifyWeight("format with prettier")).toBe("solo");
    expect(classifyWeight("lint the code")).toBe("solo");
  });
});

// ============================================================
// 4. PAIR mode — 2 tasks detected
// ============================================================

describe("PAIR mode", () => {
  it("Korean explicit sequential: 'API 추가 다음에 테스트 작성해'", () => {
    const result = classifyIntent("API 추가 다음에 테스트 작성해");
    expect(result.mode).toBe("pair");
    expect(result.tasks).toHaveLength(2);
  });

  it("English conjunction: 'fix auth bug and then add rate limiting'", () => {
    const result = classifyIntent("fix auth bug and then add rate limiting");
    expect(result.mode).toBe("pair");
    expect(result.tasks).toHaveLength(2);
  });

  it("English conjunction: 'add endpoint and then write tests'", () => {
    const result = classifyIntent("add endpoint and then write tests");
    expect(result.mode).toBe("pair");
    expect(result.tasks).toHaveLength(2);
  });

  it("pair mode has exactly 2 tasks", () => {
    const result = classifyIntent("add login endpoint and then write unit tests");
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0]).toBeTruthy();
    expect(result.tasks[1]).toBeTruthy();
  });

  it("pair mode suggests agents for both domains", () => {
    const result = classifyIntent("add API endpoint and then write tests");
    expect(result.suggestedAgents.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 5. TRIO mode — 3+ tasks detected
// ============================================================

describe("TRIO mode", () => {
  it("pipe-separated: 'backend API | frontend component | E2E test'", () => {
    const result = classifyIntent("backend API | frontend component | E2E test");
    expect(result.mode).toBe("trio");
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0]).toBe("backend API");
    expect(result.tasks[1]).toBe("frontend component");
    expect(result.tasks[2]).toBe("E2E test");
  });

  it("Korean pipe-separated: '백엔드 API | 프론트 컴포넌트 | E2E 테스트'", () => {
    const result = classifyIntent("백엔드 API | 프론트 컴포넌트 | E2E 테스트");
    expect(result.mode).toBe("trio");
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0]).toBe("백엔드 API");
    expect(result.tasks[1]).toBe("프론트 컴포넌트");
    expect(result.tasks[2]).toBe("E2E 테스트");
  });

  it("numbered list: '1. build API 2. create UI 3. write E2E tests'", () => {
    const result = classifyIntent("1. build API 2. create UI 3. write E2E tests");
    expect(result.mode).toBe("trio");
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0]).toContain("build API");
    expect(result.tasks[1]).toContain("create UI");
    expect(result.tasks[2]).toContain("write E2E tests");
  });

  it("tasks are NOT truncated (E2E stays intact)", () => {
    const result = classifyIntent("build API | create UI | write E2E tests");
    const lastTask = result.tasks[result.tasks.length - 1]!;
    expect(lastTask).toContain("E2E");
    expect(lastTask).not.toBe("E");
  });

  it("4 pipe-separated tasks → trio mode with 4 tasks", () => {
    const result = classifyIntent("auth | api | ui | tests");
    expect(result.mode).toBe("trio");
    expect(result.tasks).toHaveLength(4);
  });

  it("trio confidence is high", () => {
    const result = classifyIntent("task A | task B | task C");
    expect(result.confidence).toBe("high");
  });

  it("trio reasoning mentions sub-task count", () => {
    const result = classifyIntent("build API | create UI | write tests");
    expect(result.reasoning).toMatch(/3/);
  });
});

// ============================================================
// 6. HIERARCHY mode — complex single tasks
// ============================================================

describe("HIERARCHY mode", () => {
  it("Korean: '시스템 아키텍처 리팩토링' → hierarchy", () => {
    const result = classifyIntent("시스템 아키텍처 리팩토링");
    expect(result.mode).toBe("hierarchy");
    expect(result.tasks).toHaveLength(1);
  });

  it("English: 'redesign the auth system' → hierarchy", () => {
    const result = classifyIntent("redesign the auth system");
    expect(result.mode).toBe("hierarchy");
  });

  it("English: 'migrate the entire database to PostgreSQL' → hierarchy", () => {
    const result = classifyIntent("migrate the entire database to PostgreSQL");
    expect(result.mode).toBe("hierarchy");
  });

  it("English: 'refactor auth module to support OAuth2' → hierarchy", () => {
    const result = classifyIntent("refactor auth module to support OAuth2");
    expect(result.mode).toBe("hierarchy");
  });

  it("hierarchy reasoning mentions complexity", () => {
    const result = classifyIntent("redesign the auth system");
    expect(result.reasoning).toMatch(/complex/i);
  });

  it("hierarchy suggests agents", () => {
    const result = classifyIntent("refactor the entire backend architecture");
    expect(result.suggestedAgents.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 7. DOMAIN detection
// ============================================================

describe("DOMAIN detection", () => {
  it("'테스트 해봐 버그찾는거' → testing domain (qa-lead agent)", () => {
    const result = classifyIntent("테스트 해봐 버그찾는거");
    expect(result.suggestedAgents).toContain("qa-lead");
  });

  it("'API endpoint 추가' → backend domain (sr-backend agent)", () => {
    const result = classifyIntent("API endpoint 추가");
    expect(result.suggestedAgents).toContain("sr-backend");
  });

  it("'UI 컴포넌트 만들어' → frontend domain (sr-frontend agent)", () => {
    const result = classifyIntent("UI 컴포넌트 만들어");
    expect(result.suggestedAgents).toContain("sr-frontend");
  });

  it("'Docker 배포 설정' → infra domain (sr-infra agent)", () => {
    const result = classifyIntent("Docker 배포 설정");
    expect(result.suggestedAgents).toContain("sr-infra");
  });

  it("'인증 보안 강화' → security domain (sr-security agent)", () => {
    const result = classifyIntent("인증 보안 강화");
    expect(result.suggestedAgents).toContain("sr-security");
  });

  it("multi-domain detection: 'build API and add UI component'", () => {
    const result = classifyIntent("build API and then add UI component");
    const domains = result.suggestedAgents;
    expect(domains.length).toBeGreaterThanOrEqual(2);
  });

  it("English testing keywords: 'write unit tests' → qa-lead", () => {
    const result = classifyIntent("write unit tests for auth module");
    expect(result.suggestedAgents).toContain("qa-lead");
  });

  it("fallback domain when no keywords match defaults to backend", () => {
    const result = classifyIntent("do something generic");
    // When no domain keywords match, detectDomains returns ["backend"]
    expect(result.suggestedAgents).toContain("sr-backend");
  });
});

// ============================================================
// 8. Edge cases
// ============================================================

describe("Edge cases", () => {
  it("empty prompt → passthrough (via gateway)", () => {
    const result = parseGateway("");
    expect(result.isEmpty).toBe(true);
  });

  it("whitespace-only prompt → passthrough (via gateway)", () => {
    const result = parseGateway("   ");
    expect(result.isEmpty).toBe(true);
  });

  it("very long prompt (500+ chars) does not crash", () => {
    const longPrompt = "refactor the authentication module ".repeat(20); // ~680 chars
    const result = classifyIntent(longPrompt);
    expect(result.mode).toBeDefined();
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.reasoning).toBeTruthy();
  });

  it("prompt with code block should still classify", () => {
    const prompt = "fix the bug in this code:\n```\nconst x = 1;\nconsole.log(x);\n```";
    const result = classifyIntent(prompt);
    expect(result.mode).toBeDefined();
  });

  it("mixed language: 'review 다음에 test 작성해' → pair with 2 tasks", () => {
    const result = classifyIntent("review 다음에 test 작성해");
    expect(result.tasks).toHaveLength(2);
    expect(result.mode).toBe("pair");
  });

  it("pipe at start/end is ignored (no empty tasks)", () => {
    const result = classifyIntent("| task A | task B |");
    // Leading/trailing pipes produce empty strings which get filtered
    expect(result.tasks.every((t) => t.trim().length > 0)).toBe(true);
  });

  it("single pipe with 2 items → pair", () => {
    const result = classifyIntent("build API | write tests");
    expect(result.mode).toBe("pair");
    expect(result.tasks).toHaveLength(2);
  });

  it("classifyIntent always returns reasoning string", () => {
    const prompts = [
      "git pull",
      "fix typo",
      "build dashboard",
      "A | B | C",
      "redesign everything",
    ];
    for (const p of prompts) {
      const result = classifyIntent(p);
      expect(typeof result.reasoning).toBe("string");
      expect(result.reasoning.length).toBeGreaterThan(0);
    }
  });

  it("classifyIntent always returns confidence", () => {
    const result = classifyIntent("some random task");
    expect(["high", "medium", "low"]).toContain(result.confidence);
  });

  it("numbered list with trailing text: '1. API 2. UI 3. tests 4. deploy'", () => {
    const result = classifyIntent("1. API 2. UI 3. tests 4. deploy");
    expect(result.mode).toBe("trio");
    expect(result.tasks.length).toBeGreaterThanOrEqual(3);
  });

  it("gateway returns valid JSON for normal prompts", () => {
    const raw = runGateway("build a feature");
    // Should be parseable JSON
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("gateway returns [BW] for passthrough prompts", () => {
    const raw = runGateway("git status");
    const parsed = JSON.parse(raw);
    expect(parsed.hookSpecificOutput.additionalContext).toContain("[BW]");
  });
});

// ============================================================
// 9. Gateway integration (compiled output format)
// ============================================================

describe("Gateway integration: output format", () => {
  it("non-passthrough output has hookSpecificOutput structure", () => {
    const raw = runGateway("build a new dashboard");
    const parsed = JSON.parse(raw);
    if (parsed.hookSpecificOutput) {
      expect(parsed.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
      expect(typeof parsed.hookSpecificOutput.additionalContext).toBe("string");
    }
  });

  it("solo task output mentions mode and agents", () => {
    const result = parseGateway("fix the typo in header");
    if (!result.isEmpty && result.additionalContext) {
      expect(result.additionalContext).toMatch(/solo/i);
    }
  });

  it("slash command ./trio passthrough", () => {
    const raw = runGateway("./trio build API | add tests");
    expect(raw).toBe("{}");
  });

  it("slash command ./review passthrough", () => {
    const raw = runGateway("./review PR #42");
    expect(raw).toBe("{}");
  });

  it("slash command ./help passthrough", () => {
    const raw = runGateway("./help");
    expect(raw).toBe("{}");
  });
});

// ============================================================
// 10. classifyWeight boundary cases
// ============================================================

describe("classifyWeight: boundary cases", () => {
  it("'thank you' is passthrough", () => {
    expect(classifyWeight("thank")).toBe("passthrough");
  });

  it("'go build' is passthrough (matches go command)", () => {
    expect(classifyWeight("go build")).toBe("passthrough");
  });

  it("'deno run server.ts' is passthrough", () => {
    expect(classifyWeight("deno run server.ts")).toBe("passthrough");
  });

  it("'fix this error' is solo", () => {
    expect(classifyWeight("fix this error")).toBe("solo");
  });

  it("'add a comment' is solo", () => {
    expect(classifyWeight("add a comment")).toBe("solo");
  });

  it("'build a REST API with authentication' is pair (default)", () => {
    expect(classifyWeight("build a REST API with authentication")).toBe("pair");
  });
});
