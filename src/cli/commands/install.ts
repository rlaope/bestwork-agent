import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { ensureDataDir } from "../../data/store.js";

const NPM_ROOT = `$(npm root -g)/nysm/hooks`;

interface HookEntry {
  event: string;
  id: string;
  type: "command" | "agent" | "prompt";
  command?: string;
  prompt?: string;
  timeout: number;
  matcher?: string;
  model?: string;
}

const HOOKS_REGISTRY: HookEntry[] = [
  // === command hooks (lightweight, fast, no LLM needed) ===

  // PostToolUse — event capture
  { event: "PostToolUse", id: "nysm-hook", type: "command", command: `NYSM_HOOK_EVENT=post bash "${NPM_ROOT}/nysm-hook.sh"`, timeout: 5 },
  // PreToolUse — enforcement
  { event: "PreToolUse", id: "nysm-hook-pre", type: "command", command: `NYSM_HOOK_EVENT=pre bash "${NPM_ROOT}/nysm-hook.sh"`, timeout: 5 },
  { event: "PreToolUse", id: "nysm-scope-enforce", type: "command", command: `bash "${NPM_ROOT}/nysm-scope-enforce.sh"`, timeout: 3, matcher: "Write|Edit" },
  { event: "PreToolUse", id: "nysm-strict-enforce", type: "command", command: `bash "${NPM_ROOT}/nysm-strict-enforce.sh"`, timeout: 3 },
  // UserPromptSubmit — slash routing (fast, just pattern match + config write)
  { event: "UserPromptSubmit", id: "nysm-slash", type: "command", command: `bash "${NPM_ROOT}/nysm-slash.sh"`, timeout: 10 },
  // Stop — notifications (needs curl, not LLM)
  { event: "Stop", id: "nysm-prompt-done", type: "command", command: `bash "${NPM_ROOT}/nysm-prompt-done.sh"`, timeout: 20 },

  // === agent hooks (full LLM agent with tool access) ===

  // PostToolUse — auto validation with understanding
  {
    event: "PostToolUse",
    id: "nysm-validate-agent",
    type: "agent",
    matcher: "Write|Edit",
    timeout: 30,
    prompt: `You are nysm's validation agent. A file was just modified via $ARGUMENTS.
Check for:
1. TypeScript errors: run \`npx tsc --noEmit\` and report any errors in the changed file
2. If the file imports modules, verify the imports actually exist (grep for them)
Do NOT fix anything. Only report issues concisely (under 3 lines). If no issues, say nothing.`,
  },

  // PreToolUse — grounding check
  {
    event: "PreToolUse",
    id: "nysm-ground-agent",
    type: "agent",
    matcher: "Write|Edit",
    timeout: 15,
    prompt: `You are nysm's grounding agent. The AI is about to modify a file via $ARGUMENTS.
Check: has this file been Read in the current session? Look at the conversation history.
If NOT read yet, output a warning: "nysm grounding: Read this file before editing to avoid hallucinated content."
If already read, say nothing.`,
  },

  // UserPromptSubmit — smart gateway (the brain)
  {
    event: "UserPromptSubmit",
    id: "nysm-smart-agent",
    type: "agent",
    timeout: 60,
    model: "claude-haiku-4-5-20251001",
    prompt: `You are nysm's smart gateway agent. The user typed: $ARGUMENTS

You route to the correct nysm action. Match the user's intent:

SLASH COMMANDS (if prompt starts with ./):
- ./review → Run \`nysm review\`: check git diff for platform mismatches (Linux code on macOS, wrong runtime APIs, etc.)
- ./trio <tasks separated by |> → Execute parallel trio: for EACH task, spawn 3 Agents: Tech (implement), PM (verify requirements), Critic (check quality + hallucination). Run task groups in parallel with run_in_background.
- ./scope <path> → Write the path to ~/.nysm/scope.lock. Respond: "Scope locked to <path>."
- ./unlock → Delete ~/.nysm/scope.lock. Respond: "Scope unlocked."
- ./strict → Write "true" to ~/.nysm/strict.lock. Respond: "Strict mode ON."
- ./relax → Delete ~/.nysm/strict.lock. Respond: "Strict mode OFF."
- ./tdd <desc> → Instruct: Write tests FIRST, run to see fail, then implement to make pass.
- ./context [files] → Read the specified files (or recently changed files from \`git diff --name-only\`) and summarize them.
- ./recover → Analyze what's going wrong. Read recent errors. Suggest a completely different approach.
- ./autopsy [id] → Run \`nysm session <id>\` and \`nysm outcome <id>\`, analyze why it struggled.
- ./learn → Run \`nysm effectiveness\` and \`nysm sessions\`, extract concrete prompting rules.
- ./predict <task> → Based on \`nysm sessions\` history, estimate complexity and calls needed.
- ./guard → Run \`nysm outcome\` on current session, report health status.
- ./compare <id1> <id2> → Run \`nysm session\` on both, compare productivity.
- ./help → List all available commands.

NATURAL LANGUAGE (no ./ prefix — match intent):
- Review/hallucination keywords (리뷰, review, 검증, platform, 확인) → same as ./review
- Parallel/trio keywords (병렬, parallel, 동시, trio) → same as ./trio
- Autopsy keywords (왜 실패, why fail, 분석, post-mortem) → same as ./autopsy
- Learn keywords (프롬프트 개선, improve prompts, 배우, learn) → same as ./learn
- Loop keywords (루프, loop, 삽질, detect) → Run \`nysm loops\` and report
- Heatmap keywords (히트맵, heatmap, 활동) → Run \`nysm heatmap\` and report
- Summary keywords (세션 요약, summary, 통계) → Run \`nysm summary\` and report
- Weekly keywords (주간, weekly) → Run \`nysm summary -w\` and report
- TDD keywords (tdd, 테스트 먼저, test first) → same as ./tdd
- Scope keywords (범위, 제한, restrict) → same as ./scope
- Guard keywords (건강, health, 괜찮) → same as ./guard

If no match, do nothing. Do NOT respond to normal coding prompts.

IMPORTANT for ./trio execution:
When executing trio, you MUST actually spawn Agent tools. For each task:
1. Agent(Tech, run_in_background=true): "Implement: <task>. Read files first. Write tests. Run tests."
2. After Tech completes, Agent(PM): "Review the implementation of <task>. Does it meet requirements? Check completeness. Verdict: APPROVE or REQUEST_CHANGES."
3. After Tech completes, Agent(Critic): "Review the implementation of <task>. Check: code quality, platform correctness (this is ${process.platform} ${process.arch}), hallucination (do imports exist?), test coverage. Verdict: APPROVE or REQUEST_CHANGES."
4. If rejected, feed back to Tech and retry (max 3 rounds).
5. After all tasks done, run full test suite.`,
  },

  // Stop — platform review on completion
  {
    event: "Stop",
    id: "nysm-review-on-stop",
    type: "agent",
    timeout: 30,
    prompt: `You are nysm's platform review agent. A coding session just completed.
Run \`git diff --stat\` to see what changed. If there are code changes:
1. Run \`uname -s\` to get the OS
2. Scan the diff (\`git diff\`) for platform-specific patterns that don't match this OS:
   - Linux patterns on macOS: /proc/, cgroups, systemd, apt-get, epoll
   - macOS patterns on Linux: launchd, NSApplication, CoreFoundation
   - Windows patterns on Unix: HKEY_, registry, .exe, C:\\\\
   - Wrong runtime: Deno.* without Deno, Bun.* without Bun
3. If mismatches found, report them concisely.
If no code changes or no mismatches, say nothing.`,
  },
];

const DEPRECATED_IDS = [
  "nysm-gateway", "nysm-agents", "nysm-harness",
  "nysm-smart-gateway", "nysm-validate", "nysm-ground",
  "nysm-session-end",
];

function hasHookById(hookArray: Array<Record<string, unknown>>, id: string): boolean {
  return hookArray.some((h) => {
    if (!Array.isArray(h.hooks)) return false;
    return h.hooks.some((hh: Record<string, unknown>) => {
      if (typeof hh.command === "string" && hh.command.includes(id)) return true;
      if (typeof hh.prompt === "string" && hh.prompt.includes(id)) return true;
      if (typeof hh._nysm_id === "string" && hh._nysm_id === id) return true;
      return false;
    });
  });
}

function removeHookById(hookArray: Array<Record<string, unknown>>, id: string): Array<Record<string, unknown>> {
  return hookArray.filter((h) => {
    if (!Array.isArray(h.hooks)) return true;
    return !h.hooks.some((hh: Record<string, unknown>) => {
      if (typeof hh.command === "string" && hh.command.includes(id)) return true;
      if (typeof hh.prompt === "string" && hh.prompt.includes(id)) return true;
      if (typeof hh._nysm_id === "string" && hh._nysm_id === id) return true;
      return false;
    });
  });
}

export async function installCommand() {
  await ensureDataDir();

  const settingsPath = join(homedir(), ".claude", "settings.json");
  let settings: Record<string, unknown>;

  try {
    const raw = await readFile(settingsPath, "utf-8");
    settings = JSON.parse(raw);
  } catch {
    settings = {};
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  let added = 0;
  let removed = 0;

  // Remove deprecated hooks
  for (const id of DEPRECATED_IDS) {
    for (const event of Object.keys(hooks)) {
      const arr = hooks[event] as Array<Record<string, unknown>>;
      if (hasHookById(arr, id)) {
        hooks[event] = removeHookById(arr, id);
        removed++;
      }
    }
  }

  // Add current hooks
  for (const reg of HOOKS_REGISTRY) {
    if (!hooks[reg.event]) hooks[reg.event] = [];
    const arr = hooks[reg.event] as Array<Record<string, unknown>>;

    if (!hasHookById(arr, reg.id)) {
      const hookDef: Record<string, unknown> = {
        type: reg.type,
        _nysm_id: reg.id,
        timeout: reg.timeout,
      };

      if (reg.type === "command" && reg.command) {
        hookDef.command = reg.command;
      } else if ((reg.type === "agent" || reg.type === "prompt") && reg.prompt) {
        hookDef.prompt = reg.prompt;
        if (reg.model) hookDef.model = reg.model;
      }

      const entry: Record<string, unknown> = { hooks: [hookDef] };
      if (reg.matcher) entry.matcher = reg.matcher;
      arr.push(entry);
      added++;
    }
  }

  settings.hooks = hooks;
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  console.log(`\n  nysm installed — ${added} added, ${removed} upgraded\n`);
  console.log("  Agent hooks (full LLM with tools):");
  console.log("    Smart Gateway  — routes ./commands + natural language to agents");
  console.log("    Validation     — understands code context, checks imports exist");
  console.log("    Grounding      — verifies file was read before edit");
  console.log("    Platform Review — scans diff for OS/runtime mismatches on stop");
  console.log("");
  console.log("  Command hooks (fast, no LLM):");
  console.log("    Event capture  — records tool calls to ~/.nysm/data/");
  console.log("    Scope enforce  — blocks edits outside ./scope path");
  console.log("    Strict enforce — blocks rm -rf, git push --force");
  console.log("    Slash commands — ./discord, ./slack config");
  console.log("    Notifications  — rich Discord/Slack on prompt complete");
  console.log("");
  console.log("  Commands:");
  console.log("    ./trio t1 | t2 | t3   — parallel with Tech+PM+Critic per task");
  console.log("    ./review              — platform/hallucination check");
  console.log("    ./scope ./strict ./tdd ./recover ./context");
  console.log("    ./autopsy ./learn ./predict ./guard ./compare");
  console.log("    ./discord ./slack     — webhook setup");
  console.log("    ./help                — list all");
  console.log("    Or just type naturally — smart gateway routes it");
  console.log("");
  console.log("  Restart Claude Code to activate.\n");
}
