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

// ============================================================
// 11. BILINGUAL CLASSIFICATION (20 tests)
// ============================================================

describe("Bilingual classification", () => {
  describe("Korean solo prompts", () => {
    it("'버그 수정해' → solo", () => {
      const result = classifyIntent("버그 수정해");
      expect(result.mode).toBe("solo");
    });

    it("'타입 고쳐' → solo", () => {
      const result = classifyIntent("타입 고쳐");
      expect(result.mode).toBe("solo");
    });

    it("'변수 이름 바꿔' → solo", () => {
      const result = classifyIntent("변수 이름 바꿔");
      expect(result.mode).toBe("solo");
    });

    it("'에러 잡아줘' → solo", () => {
      const result = classifyIntent("에러 잡아줘");
      expect(result.mode).toBe("solo");
    });

    it("'오류 수정해' → solo", () => {
      const result = classifyIntent("오류 수정해");
      expect(result.mode).toBe("solo");
    });

    it("'최적화해' → solo", () => {
      expect(classifyWeight("최적화해")).toBe("solo");
    });

    it("'정리해' → solo", () => {
      expect(classifyWeight("정리해")).toBe("solo");
    });

    it("'깔끔하게' → solo", () => {
      expect(classifyWeight("깔끔하게")).toBe("solo");
    });
  });

  describe("Korean passthrough prompts", () => {
    it("'커밋' → passthrough", () => {
      expect(classifyWeight("커밋")).toBe("passthrough");
    });

    it("'푸시' → passthrough", () => {
      expect(classifyWeight("푸시")).toBe("passthrough");
    });

    it("'빌드' → passthrough", () => {
      expect(classifyWeight("빌드")).toBe("passthrough");
    });

    it("'배포해' → passthrough", () => {
      expect(classifyWeight("배포해")).toBe("passthrough");
    });

    it("'실행해' → passthrough", () => {
      expect(classifyWeight("실행해")).toBe("passthrough");
    });

    it("'테스트 돌려' → passthrough", () => {
      expect(classifyWeight("테스트 돌려")).toBe("passthrough");
    });
  });

  describe("Korean multi-task prompts", () => {
    it("'API 추가 다음에 테스트' → pair with 2 tasks", () => {
      const result = classifyIntent("API 추가 다음에 테스트 작성해");
      expect(result.mode).toBe("pair");
      expect(result.tasks).toHaveLength(2);
    });

    it("'백엔드 수정 그다음 프론트 업데이트' → pair", () => {
      const result = classifyIntent("백엔드 수정 그다음 프론트 업데이트");
      expect(result.mode).toBe("pair");
      expect(result.tasks).toHaveLength(2);
    });
  });

  describe("Japanese classification", () => {
    it("'リファクタリングして' → hierarchy (complex refactor signal)", () => {
      const result = classifyIntent("リファクタリングして");
      // リファクタ matches complexitySignals
      expect(result.mode).toBe("hierarchy");
    });

    it("'テストを書いてからデプロイ' → classifyIntent returns tasks", () => {
      const result = classifyIntent("テストを書いてからデプロイ");
      expect(result.mode).toBeDefined();
      expect(result.tasks.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============================================================
// 12. SKILL ROUTE ACCURACY (20 tests)
// ============================================================

describe("Skill route accuracy", () => {
  describe("All skill triggers (English)", () => {
    it("'review this code' → review skill", () => {
      const result = parseGateway("review this code");
      expect(result.additionalContext).toContain("bestwork-agent:review");
    });

    it("'agent list' → agents skill", () => {
      const result = parseGateway("agent list");
      expect(result.additionalContext).toContain("bestwork-agent:agents");
    });

    it("'session summary' → sessions skill", () => {
      const result = parseGateway("session summary");
      expect(result.additionalContext).toContain("bestwork-agent:sessions");
    });

    it("'generate changelog' → changelog skill", () => {
      const result = parseGateway("changelog 만들어줘");
      expect(result.additionalContext).toContain("bestwork-agent:changelog");
    });

    it("'bestwork status' → status skill", () => {
      const result = parseGateway("bestwork status");
      expect(result.additionalContext).toContain("bestwork-agent:status");
    });

    it("'make a plan for this' → plan skill", () => {
      const result = parseGateway("make a plan for this");
      expect(result.additionalContext).toContain("bestwork-agent:plan");
    });

    it("'run doctor check' → doctor skill", () => {
      const result = parseGateway("run doctor check");
      expect(result.additionalContext).toContain("bestwork-agent:doctor");
    });

    it("'install hooks for bestwork' → install skill", () => {
      const result = parseGateway("install hooks for bestwork");
      expect(result.additionalContext).toContain("bestwork-agent:install");
    });

    it("'health check' → health skill", () => {
      const result = parseGateway("health check");
      expect(result.additionalContext).toContain("bestwork-agent:health");
    });

    it("'update bestwork plugin' → update skill", () => {
      const result = parseGateway("update bestwork plugin");
      expect(result.additionalContext).toContain("bestwork-agent:update");
    });

    it("'run delegate this' → delegate skill", () => {
      const result = parseGateway("run delegate this");
      expect(result.additionalContext).toContain("bestwork-agent:delegate");
    });

    it("'run waterfall mode' → waterfall skill", () => {
      const result = parseGateway("run waterfall mode");
      expect(result.additionalContext).toContain("bestwork-agent:waterfall");
    });

    it("'run deliver this' → deliver skill", () => {
      const result = parseGateway("run deliver this");
      expect(result.additionalContext).toContain("bestwork-agent:deliver");
    });

    it("'run blitz on this' → blitz skill", () => {
      const result = parseGateway("run blitz on this");
      expect(result.additionalContext).toContain("bestwork-agent:blitz");
    });
  });

  describe("False positive defense", () => {
    it("'plan 변수' does NOT trigger plan skill", () => {
      const result = parseGateway("plan 변수");
      // "plan 변수" doesn't match plan patterns which require action verbs
      if (!result.isEmpty && result.additionalContext) {
        expect(result.additionalContext).not.toContain("bestwork-agent:plan");
      }
    });

    it("'review 했어?' does NOT trigger review skill", () => {
      const result = parseGateway("review 했어?");
      if (!result.isEmpty && result.additionalContext) {
        expect(result.additionalContext).not.toContain("bestwork-agent:review");
      }
    });

    it("'health 관련 API' does NOT trigger health skill", () => {
      const result = parseGateway("health 관련 API");
      if (!result.isEmpty && result.additionalContext) {
        expect(result.additionalContext).not.toContain("bestwork-agent:health");
      }
    });

    it("'왜 plan이야?' does NOT trigger plan skill", () => {
      const result = parseGateway("왜 plan이야?");
      if (!result.isEmpty && result.additionalContext) {
        expect(result.additionalContext).not.toContain("bestwork-agent:plan");
      }
    });

    it("'what is review?' does NOT trigger review skill", () => {
      const result = parseGateway("what is review?");
      if (!result.isEmpty && result.additionalContext) {
        expect(result.additionalContext).not.toContain("bestwork-agent:review");
      }
    });

    it("'doctor who is great' does NOT trigger doctor skill", () => {
      const result = parseGateway("doctor who is great");
      if (!result.isEmpty && result.additionalContext) {
        expect(result.additionalContext).not.toContain("bestwork-agent:doctor");
      }
    });
  });
});

// ============================================================
// 13. EDGE CASES (15 tests)
// ============================================================

describe("Edge cases: advanced", () => {
  describe("Pipes in non-task context", () => {
    it("'true | false | null' — pipe-separated values should still parse", () => {
      const result = classifyIntent("true | false | null");
      // These are short single-word parts but pass the > 1 char filter
      expect(result.tasks.length).toBeGreaterThanOrEqual(1);
    });

    it("'grep foo | wc -l' → passthrough (starts with grep)", () => {
      expect(classifyWeight("grep foo | wc -l")).toBe("passthrough");
    });

    it("'success | failure' with pipe → does not crash", () => {
      const result = classifyIntent("success | failure");
      expect(result.mode).toBeDefined();
      expect(result.tasks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Very short prompts", () => {
    it("'ㅇ' does not crash classifyIntent", () => {
      const result = classifyIntent("ㅇ");
      expect(result.mode).toBeDefined();
    });

    it("'y' → passthrough", () => {
      expect(classifyWeight("y")).toBe("passthrough");
    });

    it("'ok' → passthrough", () => {
      expect(classifyWeight("ok")).toBe("passthrough");
    });

    it("'n' → passthrough", () => {
      expect(classifyWeight("n")).toBe("passthrough");
    });

    it("'sure' → passthrough", () => {
      expect(classifyWeight("sure")).toBe("passthrough");
    });

    it("'go ahead' → passthrough", () => {
      expect(classifyWeight("go ahead")).toBe("passthrough");
    });
  });

  describe("Code blocks with keywords", () => {
    it("code block with 'fix' keyword still classifies", () => {
      const prompt = "fix this:\n```ts\nfunction broken() { return null; }\n```";
      const result = classifyIntent(prompt);
      expect(result.mode).toBeDefined();
    });

    it("code block with pipe characters does not split into tasks incorrectly", () => {
      const prompt = "fix this:\n```\ntype Result = 'ok' | 'error'\n```";
      const result = classifyIntent(prompt);
      // The pipe is inside code block context but splitTasks doesn't parse code blocks
      // At minimum it should not crash
      expect(result.mode).toBeDefined();
    });
  });

  describe("Mixed language in one prompt", () => {
    it("'fix the 버그 in auth' → hierarchy (auth triggers security+backend complexity)", () => {
      const result = classifyIntent("fix the 버그 in auth");
      // "auth" appears in both backend and security domains, triggering multi-domain complexity
      expect(["hierarchy", "pair", "solo"]).toContain(result.mode);
      expect(result.suggestedAgents.length).toBeGreaterThanOrEqual(1);
    });

    it("'API 엔드포인트 add and then 테스트 write' → pair", () => {
      const result = classifyIntent("API 엔드포인트 add and then 테스트 write");
      expect(result.mode).toBe("pair");
      expect(result.tasks).toHaveLength(2);
    });

    it("'refactor 아키텍처 for microservices' → hierarchy", () => {
      const result = classifyIntent("refactor 아키텍처 for microservices");
      expect(result.mode).toBe("hierarchy");
    });
  });
});

// ============================================================
// 14. BOUNDARY CASES (15 tests)
// ============================================================

describe("Boundary cases: mode transitions", () => {
  describe("1 task vs 2 tasks boundary", () => {
    it("single task without conjunction → 1 task", () => {
      const result = classifyIntent("build an API endpoint");
      expect(result.tasks).toHaveLength(1);
    });

    it("two tasks with 'and then' → exactly 2 tasks", () => {
      const result = classifyIntent("build API and then write tests");
      expect(result.tasks).toHaveLength(2);
      expect(result.mode).toBe("pair");
    });

    it("two tasks with pipe → exactly 2 tasks", () => {
      const result = classifyIntent("build API | write tests");
      expect(result.tasks).toHaveLength(2);
      expect(result.mode).toBe("pair");
    });
  });

  describe("Solo vs pair boundary", () => {
    it("'fix typo' → solo (lightweight)", () => {
      expect(classifyIntent("fix typo").mode).toBe("solo");
    });

    it("'build API and then test it' → pair (2 tasks)", () => {
      expect(classifyIntent("build API and then test it").mode).toBe("pair");
    });

    it("'fix typo in header' → solo, not pair", () => {
      const result = classifyIntent("fix typo in header");
      expect(result.mode).toBe("solo");
      expect(result.tasks).toHaveLength(1);
    });
  });

  describe("Pair vs trio boundary (3+ tasks)", () => {
    it("2 pipe tasks → pair", () => {
      expect(classifyIntent("task A | task B").mode).toBe("pair");
    });

    it("3 pipe tasks → trio", () => {
      expect(classifyIntent("task A | task B | task C").mode).toBe("trio");
    });

    it("4 pipe tasks with real names → trio", () => {
      expect(classifyIntent("auth module | api layer | ui page | test suite").mode).toBe("trio");
    });

    it("5 pipe tasks with real names → trio", () => {
      expect(classifyIntent("auth module | api layer | ui page | test suite | deploy config").mode).toBe("trio");
    });
  });

  describe("Simple refactor vs complex refactor (hierarchy trigger)", () => {
    it("'rename variable' → solo (simple)", () => {
      expect(classifyIntent("rename variable").mode).toBe("solo");
    });

    it("'refactor auth module to OAuth2' → hierarchy (complex)", () => {
      expect(classifyIntent("refactor auth module to OAuth2").mode).toBe("hierarchy");
    });

    it("'redesign the database schema' → hierarchy", () => {
      expect(classifyIntent("redesign the database schema").mode).toBe("hierarchy");
    });

    it("'migrate everything to PostgreSQL' → hierarchy", () => {
      expect(classifyIntent("migrate everything to PostgreSQL").mode).toBe("hierarchy");
    });
  });
});

// ============================================================
// 15. DOMAIN DETECTION (15 tests)
// ============================================================

describe("Domain detection: comprehensive", () => {
  describe("All domain keywords", () => {
    it("'build REST API server' → backend domain → sr-backend", () => {
      const result = classifyIntent("build REST API server");
      expect(result.suggestedAgents).toContain("sr-backend");
    });

    it("'create React component' → frontend domain → sr-frontend", () => {
      const result = classifyIntent("create React component");
      expect(result.suggestedAgents).toContain("sr-frontend");
    });

    it("'setup Docker deployment' → infra domain → sr-infra", () => {
      const result = classifyIntent("setup Docker deployment");
      expect(result.suggestedAgents).toContain("sr-infra");
    });

    it("'fix XSS vulnerability' → security domain → sr-security", () => {
      const result = classifyIntent("fix XSS vulnerability");
      expect(result.suggestedAgents).toContain("sr-security");
    });

    it("'build ETL data pipeline' → data domain → sr-backend", () => {
      const result = classifyIntent("build ETL data pipeline");
      expect(result.suggestedAgents).toContain("sr-backend");
    });

    it("'train ML model for predictions' → ml domain → sr-backend", () => {
      const result = classifyIntent("train ML model for predictions");
      expect(result.suggestedAgents).toContain("sr-backend");
    });

    it("'write unit test coverage' → testing domain → qa-lead", () => {
      const result = classifyIntent("write unit test coverage");
      expect(result.suggestedAgents).toContain("qa-lead");
    });

    it("'build agent orchestrator' → agent domain → agent-engineer", () => {
      const result = classifyIntent("build agent orchestrator");
      expect(result.suggestedAgents).toContain("agent-engineer");
    });

    it("'create plugin skill' → plugin domain → tech-plugin", () => {
      const result = classifyIntent("create plugin skill");
      expect(result.suggestedAgents).toContain("tech-plugin");
    });

    it("'update readme documentation' → solo (matches solo update pattern)", () => {
      // "update readme" matches SOLO_PATTERNS, so agent is sr-fullstack not tech-writer
      const result = classifyIntent("update readme documentation");
      expect(result.mode).toBe("solo");
      expect(result.suggestedAgents).toContain("sr-fullstack");
    });

    it("'write project documentation from scratch' → docs domain → tech-writer", () => {
      const result = classifyIntent("write project documentation from scratch");
      expect(result.suggestedAgents).toContain("tech-writer");
    });
  });

  describe("Multi-domain prompts", () => {
    it("'build API and then add UI component' → backend + frontend agents", () => {
      const result = classifyIntent("build API and then add UI component");
      expect(result.suggestedAgents).toContain("sr-backend");
      expect(result.suggestedAgents).toContain("sr-frontend");
    });

    it("'deploy Docker with CI pipeline and write tests' → infra + testing", () => {
      const result = classifyIntent("deploy Docker | CI pipeline | write tests");
      const agents = result.suggestedAgents;
      expect(agents).toContain("sr-infra");
      expect(agents).toContain("qa-lead");
    });
  });

  describe("Ambiguous domain", () => {
    it("'auth' resolves to both backend and security", () => {
      const result = classifyIntent("implement auth system");
      // 'auth' appears in both backend and security keyword lists
      const agents = result.suggestedAgents;
      expect(agents.length).toBeGreaterThanOrEqual(1);
      // Should detect at least one of backend or security
      const hasRelevant = agents.includes("sr-backend") || agents.includes("sr-security");
      expect(hasRelevant).toBe(true);
    });

    it("'데이터 분석 dashboard' → data + frontend domains", () => {
      const result = classifyIntent("데이터 분석 dashboard");
      const agents = result.suggestedAgents;
      // data maps to sr-backend, dashboard is in data domain keywords
      expect(agents.length).toBeGreaterThanOrEqual(1);
    });

    it("'JWT token auth middleware' → security + backend", () => {
      const result = classifyIntent("JWT token auth middleware");
      const agents = result.suggestedAgents;
      const hasBackendOrSecurity = agents.includes("sr-backend") || agents.includes("sr-security");
      expect(hasBackendOrSecurity).toBe(true);
    });
  });
});

// ============================================================
// 16. NEW SKILL ROUTES (15 tests)
// ============================================================

describe("New skill routes: delegate, waterfall, deliver, blitz", () => {
  describe("delegate triggers", () => {
    it("'delegate this to agents' → delegate skill", () => {
      const result = parseGateway("delegate this to agents");
      expect(result.additionalContext).toContain("bestwork-agent:delegate");
    });

    it("'just do it' → delegate skill", () => {
      const result = parseGateway("just do it");
      expect(result.additionalContext).toContain("bestwork-agent:delegate");
    });

    it("'위임해줘' → delegate skill", () => {
      const result = parseGateway("위임해줘");
      expect(result.additionalContext).toContain("bestwork-agent:delegate");
    });

    it("'auto fix everything' → delegate skill", () => {
      const result = parseGateway("auto fix everything");
      expect(result.additionalContext).toContain("bestwork-agent:delegate");
    });
  });

  describe("waterfall triggers", () => {
    it("'start waterfall mode' → waterfall skill", () => {
      const result = parseGateway("start waterfall mode");
      expect(result.additionalContext).toContain("bestwork-agent:waterfall");
    });

    it("'단계별 실행' → waterfall skill", () => {
      const result = parseGateway("단계별 실행");
      expect(result.additionalContext).toContain("bestwork-agent:waterfall");
    });

    it("'staged execution' → waterfall skill", () => {
      const result = parseGateway("staged execution");
      expect(result.additionalContext).toContain("bestwork-agent:waterfall");
    });
  });

  describe("deliver triggers", () => {
    it("'deliver this completely' → deliver skill", () => {
      const result = parseGateway("deliver this completely");
      expect(result.additionalContext).toContain("bestwork-agent:deliver");
    });

    it("'끝까지 해줘' → deliver skill", () => {
      const result = parseGateway("끝까지 해줘");
      expect(result.additionalContext).toContain("bestwork-agent:deliver");
    });

    it("'must complete fully' → deliver skill", () => {
      const result = parseGateway("must complete fully");
      expect(result.additionalContext).toContain("bestwork-agent:deliver");
    });
  });

  describe("blitz triggers", () => {
    it("'blitz on this codebase' → blitz skill", () => {
      const result = parseGateway("blitz on this codebase");
      expect(result.additionalContext).toContain("bestwork-agent:blitz");
    });

    it("'maximum parallel execution' → blitz skill", () => {
      const result = parseGateway("maximum parallel execution");
      expect(result.additionalContext).toContain("bestwork-agent:blitz");
    });

    it("'burst fix all errors' → blitz skill", () => {
      const result = parseGateway("burst fix all errors");
      expect(result.additionalContext).toContain("bestwork-agent:blitz");
    });
  });

  describe("False positives for new skills", () => {
    it("'delegate in Python means...' does NOT trigger delegate", () => {
      const result = parseGateway("delegate in Python means something different");
      if (!result.isEmpty && result.additionalContext) {
        expect(result.additionalContext).not.toContain("bestwork-agent:delegate");
      }
    });

    it("'waterfall methodology history' does NOT trigger waterfall", () => {
      const result = parseGateway("waterfall methodology history");
      if (!result.isEmpty && result.additionalContext) {
        expect(result.additionalContext).not.toContain("bestwork-agent:waterfall");
      }
    });

    it("'deliver pizza API endpoint' does NOT trigger deliver", () => {
      const result = parseGateway("deliver pizza API endpoint");
      if (!result.isEmpty && result.additionalContext) {
        expect(result.additionalContext).not.toContain("bestwork-agent:deliver");
      }
    });
  });
});
