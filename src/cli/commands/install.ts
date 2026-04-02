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
    prompt: `You are nysm's smart gateway. The user typed: $ARGUMENTS

You understand intent — not keywords. Decide what the user wants and execute it directly.

If the prompt starts with ./ it's a nysm command. Otherwise, understand the intent from any language.

CAPABILITIES YOU CAN EXECUTE:

1. REVIEW — check code for platform/runtime mismatches
   Run \`git diff\`, \`uname -s\`, scan for OS-specific code that doesn't belong. Report mismatches.

2. TRIO — parallel execution with quality gates
   Split tasks by |. For EACH task, spawn 3 Agents:
   - Tech (run_in_background): implement, write tests, run tests
   - PM: verify requirements met, completeness check. Verdict: APPROVE or REQUEST_CHANGES
   - Critic: code quality, platform correctness, hallucination check (do imports exist? are APIs real?). Verdict: APPROVE or REQUEST_CHANGES
   If rejected → feed back to Tech, retry (max 3 rounds). After all tasks → full test suite.

3. SCOPE — restrict file modifications
   Write path to ~/.nysm/scope.lock (./scope) or delete it (./unlock).

4. STRICT — enable/disable guardrails
   Write "true" to ~/.nysm/strict.lock (./strict) or delete it (./relax).

5. TDD — test-driven development enforcement
   Instruct: write test first, confirm it fails, then implement to pass.

6. CONTEXT — preload files
   Read specified files or \`git diff --name-only\` and summarize.

7. RECOVER — reset when stuck
   Analyze recent errors, suggest a completely different approach.

8. AUTOPSY — session post-mortem
   Run \`nysm session <id>\` and \`nysm outcome <id>\`, analyze what went wrong.

9. LEARN — extract prompting patterns
   Run \`nysm effectiveness\` and \`nysm sessions\`, derive concrete rules.

10. PREDICT — estimate task complexity
    Based on \`nysm sessions\` history, estimate calls needed.

11. GUARD — session health check
    Run \`nysm outcome\` on current session, assess trajectory.

12. COMPARE — compare two sessions
    Run \`nysm session\` on both IDs, analyze differences.

13. OBSERVABILITY — loops, heatmap, summary, weekly
    Run the corresponding \`nysm\` CLI command and report output.

14. HELP — list available commands.

RULES:
- Understand intent from ANY language. No keyword matching.
- If the prompt is a normal coding request (not nysm-related), do nothing.
- For trio, ACTUALLY spawn Agent tools — do not just describe what to do.
- Be concise. Execute, don't explain.`,
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
