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
  "./help",
  // All skills — passthrough when invoked as ./command
  "./agents", "./changelog", "./doctor", "./health", "./install",
  "./onboard", "./plan", "./review", "./sessions", "./status",
  "./trio", "./update",
];

// Skill keyword map — natural language to skill name
// hook: shell script name to execute directly (output becomes additionalContext)
// no hook: use Skill tool invocation via additionalContext message
const SKILL_ROUTES: Array<{ patterns: RegExp[]; skill: string; reason: string; hook?: string; env?: string }> = [
  {
    patterns: [
      /리뷰.*(해줘|해|하자|부탁|시작|돌려)/i,
      /코드.*검증|검증.*해|할루시네이션.*(검사|체크|확인|scan)/i,
      /(?:please\s+|run\s+|do\s+)?review\s+(?:this|the|my|code|pr|changes)/i,
      /(?:scan|check)\s+(?:for\s+)?hallucination/i,
      /コードレビュー.*(して|お願い|実行)/i,
    ],
    skill: "review",
    reason: "code review and hallucination scan",
    hook: "bestwork-review.sh",
    env: "BESTWORK_REVIEW_TRIGGER=1",
  },
  {
    patterns: [/에이전트.*목록|에이전트.*리스트|agent.*list|프로필.*보여|エージェント一覧/i],
    skill: "agents",
    reason: "agent catalog lookup",
  },
  {
    patterns: [/(session|세션).*(summary|요약|stats|통계|list|목록)/i],
    skill: "sessions",
    reason: "session stats",
  },
  {
    patterns: [/changelog.*(만들|생성|해줘|해|generate)|변경.*로그|변경.*이력|릴리즈.*노트/i],
    skill: "changelog",
    reason: "changelog generation",
  },
  {
    patterns: [/(bestwork|bw).*(status|상태|설정|config)/i],
    skill: "status",
    reason: "configuration status check",
  },
  {
    patterns: [/온보딩.*(해|시작|가이드)|setup.*guide|시작.*가이드/i],
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
    patterns: [
      /health\s*(check|scan|report|status)/i,
      /(?:run|do|check)\s+health/i,
      /건강.*(확인|체크|검사|봐줘)/i,
      /상태.*(체크|확인).*(해|줘|하자)/i,
      /ヘルスチェック/i,
    ],
    skill: "health",
    reason: "session health check",
  },
  {
    patterns: [
      /(?:make|create|build|run|do)\s+(?:a\s+)?plan/i,
      /plan\s+(?:this|the|for|out)/i,
      /플랜.*(짜|세워|만들|해줘|해|하자|부탁)/i,
      /계획.*(세워|짜|만들|해줘|해|하자|수립)/i,
      /설계.*(해줘|해|하자|시작)/i,
      /팀.*(구성|배정).*(해|줘|하자)/i,
      /analyze\s+scope/i,
      /분석.*후.*실행/i,
    ],
    skill: "plan",
    reason: "scope analysis and team allocation",
  },
  {
    patterns: [
      /(?:run|do|execute)\s+doctor/i,
      /doctor\s+(?:check|scan|this|the|my|project)/i,
      /진단.*(해줘|해|하자|돌려|시작|부탁)/i,
      /정합성.*(검사|확인|체크)/i,
      /배포.*검사|deploy\s*check|build\s*check/i,
      /의존성.*검사|dependency\s*check|CI\s*검사|환경.*변수.*검사/i,
    ],
    skill: "doctor",
    reason: "project deploy/code integrity check",
  },
  {
    patterns: [
      /trio.*(돌려|해줘|해|하자|실행|시작)/i,
      /트리오.*(돌려|해줘|해|하자|실행)/i,
      /병렬.*실행|parallel.*task/i,
      /동시에.*(해|돌려|실행)/i,
      /quality.*gate/i,
    ],
    skill: "trio",
    reason: "parallel execution with quality gates",
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
      // If skill has a shell hook, execute it directly (same as ./command)
      if (route.hook && PLUGIN_ROOT) {
        try {
          const hookInput = JSON.stringify({ prompt, session_id: input.session_id ?? "" });
          const envPrefix = route.env ? `${route.env} ` : "";
          const result = execSync(
            `echo '${hookInput.replace(/'/g, "'\\''")}' | ${envPrefix}bash "${PLUGIN_ROOT}/hooks/${route.hook}"`,
            { encoding: "utf-8", timeout: 10000 }
          ).trim();
          if (result && result !== "{}") {
            log(`[BW gateway → ${route.skill}] ${route.reason}`);
            process.stdout.write(result + "\n");
            return;
          }
        } catch {}
      }
      // Fallback: force Claude to invoke the skill via MAGIC KEYWORD pattern
      const skillUpper = route.skill.toUpperCase().replace(/-/g, "_");
      output(
        `[MAGIC KEYWORD: BESTWORK_${skillUpper}]\n\n` +
        `You MUST invoke the skill using the Skill tool:\n` +
        `- Skill name: bestwork-agent:${route.skill}\n` +
        `- Reason: ${route.reason}\n\n` +
        `IMPORTANT: Do NOT skip this. Invoke the Skill tool with skill="bestwork-agent:${route.skill}" before doing anything else.`
      );
      return;
    }
  }

  // Tier 2: Task classification — analyze prompt and determine execution mode
  const intent = classifyIntent(prompt);

  const agentList = intent.suggestedAgents.join(", ");

  if (intent.mode === "passthrough") {
    output(`[BW] direct execution`);
    return;
  }

  if (intent.mode === "solo") {
    const agent = intent.suggestedAgents[0] || "tech-fullstack";
    output(`[BW] solo — bestwork:${agent}\n\nClassification: ${intent.reasoning}\nProceed directly. You are operating as a bestwork agent (bestwork:${agent}).`);
    return;
  }

  // Non-solo: present team structure options with pros/cons, let user pick
  const tasks = intent.tasks.map((t: string, i: number) => {
    const agent = intent.suggestedAgents[i] || intent.suggestedAgents[0] || "tech-fullstack";
    return `  ${i + 1}. ${t} → ${agent}`;
  }).join("\n");

  // Detect language from prompt for localized descriptions
  const isKo = /[가-힣]/.test(prompt);
  const isJa = /[\u3040-\u309F\u30A0-\u30FF]/.test(prompt);

  // Outcome-based descriptions (what the user actually gets)
  // Result-focused descriptions (what's different about the output, not the process)
  const DESC = isKo ? {
    trio: "3관점 검증된 코드. 요구사항 충족 확인 + 품질 리포트 포함",
    squad: "멀티 도메인 동시 커버. 넓은 범위를 빠르게 완성",
    hierarchy: "아키텍처 레벨 검토 완료된 코드. 기술 부채 최소화",
    pair: "상호 검증된 집중 코드. 빠른 딜리버리 + 크로스체크",
    solo: "즉시 완성. 최소 지연, 단일 전문가 품질",
  } : isJa ? {
    trio: "3視点で検証済みコード。要件確認+品質レポート付き",
    squad: "マルチドメイン同時カバー。広範囲を高速完成",
    hierarchy: "アーキテクチャレベル検証済みコード。技術的負債最小化",
    pair: "相互検証された集中コード。高速デリバリー+クロスチェック",
    solo: "即時完成。最小遅延、単一専門家品質",
  } : {
    trio: "Code verified from 3 perspectives. Requirements confirmed + quality report included",
    squad: "Multi-domain covered simultaneously. Wide scope delivered fast",
    hierarchy: "Architecture-level reviewed code. Minimal tech debt",
    pair: "Cross-verified focused code. Fast delivery + mutual check",
    solo: "Instant completion. Minimal latency, single expert quality",
  };

  const qLabel = isKo ? "어떤 팀 구조로 진행할까요?" : isJa ? "どのチーム構成で進めますか？" : "Which team structure?";

  // Build options: recommended first, then alternatives
  const modes = ["trio", "squad", "hierarchy", "pair"] as const;
  const rec = intent.mode;
  const sorted = [rec, ...modes.filter(m => m !== rec)];
  const optionLines = sorted.map((m, i) => {
    const label = i === 0 ? `${m.charAt(0).toUpperCase() + m.slice(1)} (Recommended)` : m.charAt(0).toUpperCase() + m.slice(1);
    return `  ${i + 1}. label: "${label}", description: "${DESC[m as keyof typeof DESC]}"`;
  }).join("\n");

  output(
`[BW] ${intent.tasks.length} sub-tasks detected (bestwork:${agentList})

Tasks:
${tasks}

You MUST use AskUserQuestion tool to let the user pick the team structure:
- question: "${qLabel}"
- header: "BW Team"
- options:
${optionLines}

After user picks, execute that mode with the tasks listed above. Print [BW] {mode} — bestwork:{agents} as first line.`
  );
}

main().catch(() => process.stdout.write("{}\n"));
