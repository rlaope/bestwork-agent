/**
 * Smart Gateway — prompt analyzer for UserPromptSubmit hook
 *
 * Flow:
 * 1. Read stdin JSON from Claude Code
 * 2. classifyIntent() → mode (passthrough/solo/pair/trio/hierarchy)
 * 3. If not passthrough → buildExecutionPlan() with proper agents
 * 4. Output additionalContext with team composition + execution instructions
 *
 * Replaces the keyword-based bestwork-smart-gateway.sh
 */

import { classifyIntent, buildExecutionPlan, formatPlan, type ExecutionMode } from "./orchestrator.js";
import { TEAM_PRESETS } from "./org.js";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

const BW_DIR = join(homedir(), ".bestwork");
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || "";

// Slash command prefixes that should passthrough to the shell handler
const SLASH_PREFIXES = [
  "./bw-install", "./discord", "./slack", "./bestwork",
  "./scope", "./unlock", "./strict", "./relax", "./context",
  "./parallel", "./tdd", "./recover",
  "./autopsy", "./similar", "./learn", "./predict", "./guard", "./compare",
  "./review", "./trio", "./help",
];

// Skill keyword map — natural language to skill name
const SKILL_ROUTES: Array<{ patterns: RegExp[]; skill: string; reason: string }> = [
  {
    patterns: [/리뷰|review|검증|verify|할루시네이션|hallucination|검사|scan|コードレビュー|レビュー/i],
    skill: "review",
    reason: "code review and hallucination scan",
  },
  {
    patterns: [/에이전트.*목록|에이전트.*리스트|agent.*list|agents|프로필|エージェント一覧|エージェント/i],
    skill: "agents",
    reason: "agent catalog lookup",
  },
  {
    patterns: [/(session|세션).*(summary|요약|stats|통계|list|목록)/i],
    skill: "sessions",
    reason: "session stats",
  },
  {
    patterns: [/changelog|변경.*로그|변경.*이력|릴리즈.*노트/i],
    skill: "changelog",
    reason: "changelog generation",
  },
  {
    patterns: [/(bestwork|bw).*(status|상태|설정|config)/i],
    skill: "status",
    reason: "configuration status check",
  },
  {
    patterns: [/onboard|온보딩|시작.*가이드|setup.*guide/i],
    skill: "onboard",
    reason: "onboarding guide",
  },
  {
    patterns: [/(update|업데이트|업그레이드|upgrade).*(bestwork|bw|플러그인|plugin)/i],
    skill: "update",
    reason: "update check",
  },
  {
    patterns: [/(install|설치|인스톨).*(hook|훅|bestwork|bw)/i],
    skill: "install",
    reason: "hook installation",
  },
  {
    patterns: [/health|건강|상태.*체크|상태.*확인|ヘルスチェック/i],
    skill: "health",
    reason: "session health check",
  },
];

function modeToTeam(mode: ExecutionMode): string | null {
  switch (mode) {
    case "trio":
    case "squad":
      return "feature-squad";
    case "hierarchy":
      return "full-team";
    case "pair":
      return "feature-squad";
    case "solo":
      return "feature-squad";
    default:
      return null;
  }
}

async function readStdin(): Promise<{ prompt: string; session_id?: string } | null> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => {
      try { resolve(JSON.parse(data)); } catch { resolve(null); }
    });
    setTimeout(() => resolve(null), 500);
  });
}

function log(msg: string): void {
  try {
    mkdirSync(BW_DIR, { recursive: true });
    const ts = new Date().toISOString().slice(11, 19);
    appendFileSync(join(BW_DIR, "gateway.log"), `[${ts}] ${msg}\n`);
  } catch {}
}

function output(context: string): void {
  log(context.split("\n")[0]);

  const result = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: context,
    },
  };
  process.stdout.write(JSON.stringify(result) + "\n");
}

async function main() {
  const input = await readStdin();
  if (!input) { process.stdout.write("{}\n"); return; }

  const prompt = input.prompt ?? "";
  if (!prompt.trim()) { process.stdout.write("{}\n"); return; }

  // Tier 0: Slash commands → passthrough to shell handler
  for (const prefix of SLASH_PREFIXES) {
    if (prompt.trimStart().startsWith(prefix)) {
      process.stdout.write("{}\n");
      return;
    }
  }

  // Tier 1: Skill routing — check if prompt matches a BW skill
  const lower = prompt.toLowerCase();
  for (const route of SKILL_ROUTES) {
    if (route.patterns.some((p) => p.test(lower))) {
      output(`[BW gateway] matched skill: bestwork-agent:${route.skill} — ${route.reason}. Use the Skill tool to invoke bestwork-agent:${route.skill} now.`);
      return;
    }
  }

  // Tier 2: Task classification — analyze prompt and determine execution mode
  const intent = classifyIntent(prompt);

  if (intent.mode === "passthrough") {
    process.stdout.write("{}\n");
    return;
  }

  // Tier 2a: trio/pair → delegate to trio hook (same as ./trio)
  if ((intent.mode === "trio" || intent.mode === "pair") && intent.tasks.length > 1 && PLUGIN_ROOT) {
    const tasksStr = intent.tasks.join(" | ");
    try {
      const hookInput = JSON.stringify({ prompt: `./trio ${tasksStr}`, session_id: input.session_id ?? "" });
      const result = execSync(
        `echo '${hookInput.replace(/'/g, "'\\''")}' | BESTWORK_TRIO_TRIGGER=1 bash "${PLUGIN_ROOT}/hooks/bestwork-trio.sh"`,
        { encoding: "utf-8", timeout: 5000 }
      ).trim();
      if (result && result !== "{}") {
        log(`[BW gateway → trio] ${intent.tasks.length} tasks: ${tasksStr}`);
        process.stdout.write(result + "\n");
        return;
      }
    } catch {}
  }

  // Build structured dispatch context
  const lines: string[] = [];
  lines.push(`[BW gateway: ${intent.mode} mode]`);
  lines.push(`Classification: ${intent.reasoning}`);
  lines.push(`Confidence: ${intent.confidence}`);

  if (intent.tasks.length > 1) {
    lines.push(`\nSub-tasks (${intent.tasks.length}):`);
    intent.tasks.forEach((t: string, i: number) => lines.push(`  ${i + 1}. ${t}`));
  }

  if (intent.suggestedAgents.length > 0) {
    lines.push(`\nAssigned agents: ${intent.suggestedAgents.join(", ")}`);
  }

  // Build execution plan
  const teamName = modeToTeam(intent.mode);
  if (teamName) {
    const plan = buildExecutionPlan(teamName, prompt);
    if (plan) {
      lines.push(formatPlan(plan));
    }
  }

  // Execution instructions based on mode
  if (intent.mode === "hierarchy") {
    lines.push("\nExecution: Sequential chain. Junior implements → Senior reviews → Lead approves.");
  } else if (intent.mode === "solo") {
    lines.push("\nExecution: Single agent. Proceed directly.");
  }

  output(lines.join("\n"));
}

main().catch(() => process.stdout.write("{}\n"));
