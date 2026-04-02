import { describe, it, expect } from "vitest";

/**
 * Gateway routing tests
 *
 * The smart gateway is an agent-type hook — it runs as an LLM agent
 * that understands intent. These tests validate the routing logic
 * for the shell-based fallback hooks (bestwork-smart-gateway.sh).
 *
 * Test approach: simulate the regex matching that the shell gateway uses.
 */

// Simulate the shell gateway's slash command matching
function matchSlashCommand(prompt: string): string | null {
  const commands: Record<string, string> = {
    "./discord": "slash:discord",
    "./slack": "slash:slack",
    "./bestwork": "slash:status",
    "./scope": "harness:scope",
    "./unlock": "harness:unlock",
    "./strict": "harness:strict",
    "./relax": "harness:relax",
    "./context": "harness:context",
    "./parallel": "harness:parallel",
    "./tdd": "harness:tdd",
    "./recover": "harness:recover",
    "./autopsy": "agents:autopsy",
    "./similar": "agents:similar",
    "./learn": "agents:learn",
    "./predict": "agents:predict",
    "./guard": "agents:guard",
    "./compare": "agents:compare",
    "./review": "review",
    "./trio": "trio",
    "./help": "help",
  };

  for (const [prefix, route] of Object.entries(commands)) {
    if (prompt.startsWith(prefix)) return route;
  }
  return null;
}

// Simulate natural language routing keywords
function matchNaturalLanguage(prompt: string): string | null {
  const lower = prompt.toLowerCase();

  const patterns: [RegExp, string][] = [
    [/(리뷰|review|검증|verify|플랫폼|platform|할루시네이션|hallucination).*(코드|code|확인|check)/, "review"],
    [/(병렬|parallel|동시|concurrent|trio).*(실행|run|돌|execute|작업|task)/, "trio"],
    [/(왜.*실패|why.*fail|분석|analyze|autopsy|post.?mortem|세션.*문제)/, "agents:autopsy"],
    [/(프롬프트|prompt).*(개선|improve|배우|learn|규칙|rule|팁|tip)/, "agents:learn"],
    [/(loop|루프).*(detect|감지|check|찾)/, "observe:loops"],
    [/(heatmap|히트맵|activity|활동).*(show|보여|view)/, "observe:heatmap"],
    [/(session|세션).*(summary|요약|stats|통계)/, "observe:summary"],
    [/(weekly|주간).*(summary|report|요약|리포트)/, "observe:weekly"],
    [/(tdd|테스트.*먼저|test.*first|테스트.*주도)/, "harness:tdd"],
    [/(범위|scope|제한|restrict).*(설정|set|폴더|dir|파일|file)/, "harness:scope"],
    [/(예측|predict|얼마나|how long|복잡도|complexity|걸릴|estimate)/, "agents:predict"],
    [/(세션.*건강|session.*health|guard|괜찮|on track|궤도)/, "agents:guard"],
  ];

  for (const [re, route] of patterns) {
    if (re.test(lower)) return route;
  }
  return null;
}

function route(prompt: string): string | null {
  return matchSlashCommand(prompt) ?? matchNaturalLanguage(prompt);
}

describe("gateway: slash command routing", () => {
  it("routes ./discord to slash:discord", () => {
    expect(route("./discord https://webhooks.example.com")).toBe("slash:discord");
  });

  it("routes ./slack to slash:slack", () => {
    expect(route("./slack https://hooks.slack.com/xxx")).toBe("slash:slack");
  });

  it("routes ./scope to harness:scope", () => {
    expect(route("./scope src/auth/")).toBe("harness:scope");
  });

  it("routes ./trio to trio", () => {
    expect(route("./trio task1 | task2 | task3")).toBe("trio");
  });

  it("routes ./review to review", () => {
    expect(route("./review")).toBe("review");
  });

  it("routes ./autopsy to agents:autopsy", () => {
    expect(route("./autopsy b322dc3e")).toBe("agents:autopsy");
  });

  it("routes ./learn to agents:learn", () => {
    expect(route("./learn")).toBe("agents:learn");
  });

  it("routes ./predict to agents:predict", () => {
    expect(route("./predict implement auth API")).toBe("agents:predict");
  });

  it("routes ./tdd to harness:tdd", () => {
    expect(route("./tdd add user authentication")).toBe("harness:tdd");
  });

  it("routes ./help to help", () => {
    expect(route("./help")).toBe("help");
  });

  it("routes ./strict to harness:strict", () => {
    expect(route("./strict")).toBe("harness:strict");
  });

  it("routes ./recover to harness:recover", () => {
    expect(route("./recover")).toBe("harness:recover");
  });
});

describe("gateway: natural language routing", () => {
  it("routes 'review my code' to review", () => {
    expect(route("review my code for platform issues")).toBe("review");
  });

  it("routes Korean review request", () => {
    expect(route("코드 리뷰 확인해줘")).toBe("review");
  });

  it("routes 'run in parallel' to trio", () => {
    expect(route("parallel execution run these tasks")).toBe("trio");
  });

  it("routes Korean parallel request", () => {
    expect(route("이 작업들 병렬로 실행해줘")).toBe("trio");
  });

  it("routes 'why did it fail' to autopsy", () => {
    expect(route("why did that session fail")).toBe("agents:autopsy");
  });

  it("routes 'detect loops' to loops", () => {
    expect(route("loop detect in the session")).toBe("observe:loops");
  });

  it("routes Korean loop detection", () => {
    expect(route("루프 감지해줘")).toBe("observe:loops");
  });

  it("routes 'show heatmap' to heatmap", () => {
    expect(route("heatmap show me the activity")).toBe("observe:heatmap");
  });

  it("routes 'session summary' to summary", () => {
    expect(route("session summary please")).toBe("observe:summary");
  });

  it("routes 'weekly report' to weekly", () => {
    expect(route("weekly report 보여줘")).toBe("observe:weekly");
  });

  it("routes 'improve prompts' to learn", () => {
    expect(route("prompt improve tips please")).toBe("agents:learn");
  });

  it("routes 'predict complexity' to predict", () => {
    expect(route("predict how long this will take")).toBe("agents:predict");
  });

  it("routes 'tdd' to tdd", () => {
    expect(route("tdd로 개발하자")).toBe("harness:tdd");
  });
});

describe("gateway: no false positives", () => {
  it("returns null for normal coding prompts", () => {
    expect(route("add a login button to the header")).toBeNull();
  });

  it("returns null for plain text", () => {
    expect(route("hello world")).toBeNull();
  });

  it("returns null for git commands", () => {
    expect(route("git commit -m 'fix auth'")).toBeNull();
  });

  it("returns null for file editing requests", () => {
    expect(route("edit the config file to add the new setting")).toBeNull();
  });
});
