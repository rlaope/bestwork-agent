import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { ensureDataDir } from "../../../data/store.js";
import { bwOk, bwLog } from "../../../utils/brand.js";

// Resolve hooks dir at runtime: npm global → plugin cache fallback
const BW_HOOKS_RESOLVE = `BW_HOOKS="$(npm root -g 2>/dev/null)/bestwork-agent/hooks"; [ ! -d "$BW_HOOKS" ] && BW_HOOKS="$(ls -d ~/.claude/plugins/cache/bestwork-tools/bestwork-agent/*/hooks 2>/dev/null | sort -V | tail -1)"; [ ! -d "$BW_HOOKS" ] && exit 0;`;

function bwCmd(script: string, extraEnv = ""): string {
  return `${BW_HOOKS_RESOLVE} ${extraEnv}bash "$BW_HOOKS/${script}"`;
}


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
  { event: "PostToolUse", id: "bestwork-hook", type: "command", command: bwCmd("bestwork-hook.sh", "BESTWORK_HOOK_EVENT=post "), timeout: 5 },
  // PreToolUse — enforcement
  { event: "PreToolUse", id: "bestwork-hook-pre", type: "command", command: bwCmd("bestwork-hook.sh", "BESTWORK_HOOK_EVENT=pre "), timeout: 5 },
  { event: "PreToolUse", id: "bestwork-scope-enforce", type: "command", command: bwCmd("bestwork-scope-enforce.sh"), timeout: 3, matcher: "Write|Edit" },
  { event: "PreToolUse", id: "bestwork-strict-enforce", type: "command", command: bwCmd("bestwork-strict-enforce.sh"), timeout: 3 },
  // UserPromptSubmit — slash routing (fast, just pattern match + config write)
  { event: "UserPromptSubmit", id: "bestwork-slash", type: "command", command: bwCmd("bestwork-slash.sh"), timeout: 10 },
  // Stop — handled by plugin hooks.json (not install.ts) to avoid duplicate notifications
  // SessionStart — update check
  { event: "SessionStart", id: "bestwork-update-check", type: "command", command: bwCmd("bestwork-update-check.sh"), timeout: 5 },

  // === agent hooks (full LLM agent with tool access) ===

  // PostToolUse — auto validation with understanding
  {
    event: "PostToolUse",
    id: "bestwork-validate-agent",
    type: "agent",
    matcher: "Write|Edit",
    timeout: 30,
    prompt: `You are bestwork's validation agent. A file was just modified via $ARGUMENTS.
Check for:
1. TypeScript errors: run \`npx tsc --noEmit\` and report any errors in the changed file
2. If the file imports modules, verify the imports actually exist (grep for them)
Do NOT fix anything. Only report issues concisely (under 3 lines). Prefix all output with [BW]. If no issues, say nothing.`,
  },

  // PreToolUse — grounding check
  {
    event: "PreToolUse",
    id: "bestwork-ground-agent",
    type: "agent",
    matcher: "Write|Edit",
    timeout: 15,
    prompt: `You are bestwork's grounding agent. The AI is about to modify a file via $ARGUMENTS.
Check: has this file been Read in the current session? Look at the conversation history.
If NOT read yet, output a warning: "[BW] Grounding: Read this file before editing to avoid hallucinated content."
If already read, say nothing.`,
  },

  // UserPromptSubmit — smart gateway agent (handles execution for non-solo tasks)
  // The command hook (smart-gateway.js) already classified the task and logged [BW].
  // This agent hook reads that classification and handles: AskUserQuestion, skill invoke, team execution.
  {
    event: "UserPromptSubmit",
    id: "bestwork-smart-agent",
    type: "agent",
    timeout: 60,
    model: "claude-haiku-4-5-20251001",
    prompt: `You are bestwork's execution agent. The command hook already classified this prompt.

Read the classification from the other hook's additionalContext (it starts with [BW]).

YOUR ROLE: Handle non-passthrough, non-solo tasks. For solo/passthrough, do nothing.

IF the classification shows multiple tasks (e.g. "[BW] 2 task(s), 4 agents"):
1. Use AskUserQuestion to confirm the plan with the user:
   - "이 계획으로 진행할까요?" / "Proceed with this plan?"
   - Options: "확인, 진행" / "조정하고 싶어" / "솔로로 할게"
2. On confirm: invoke the appropriate bestwork skill (bestwork-agent:trio for parallel tasks)
3. On solo: do nothing, let the main agent handle it

IF the classification shows a skill route (e.g. "MAGIC KEYWORD: BESTWORK_REVIEW"):
- Invoke that skill using the Skill tool

IF the classification is solo or passthrough:
- Do nothing. Say nothing. Let the main agent proceed.

RULES:
- NEVER duplicate work the command hook already did
- NEVER re-classify the prompt
- Only act on non-solo classifications
- Be silent for solo/passthrough`,
  },

  // Stop — platform review handled by plugin hooks.json (not install.ts) to avoid duplicate execution
];

const DEPRECATED_IDS = [
  "bestwork-gateway", "bestwork-agents", "bestwork-harness",
  "bestwork-smart-gateway", "bestwork-validate", "bestwork-ground",
  "bestwork-session-end",
  // Stop hooks now live exclusively in plugin hooks.json — remove from settings.json
  "bestwork-prompt-done", "bestwork-review-on-stop",
];

function hasHookById(hookArray: Array<Record<string, unknown>>, id: string): boolean {
  return hookArray.some((h) => {
    if (!Array.isArray(h.hooks)) return false;
    return h.hooks.some((hh: Record<string, unknown>) => {
      if (typeof hh.command === "string" && hh.command.includes(id)) return true;
      if (typeof hh.prompt === "string" && hh.prompt.includes(id)) return true;
      if (typeof hh._bestwork_id === "string" && hh._bestwork_id === id) return true;
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
      if (typeof hh._bestwork_id === "string" && hh._bestwork_id === id) return true;
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
        _bestwork_id: reg.id,
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

  // Configure statusLine (HUD) — copy to fixed path for short command
  const bwDir = join(homedir(), ".bestwork");
  await mkdir(bwDir, { recursive: true });

  // Find and copy HUD script to ~/.bestwork/hud.mjs
  let hudSrc: string | null = null;
  const npmHud = join(execSync("npm root -g 2>/dev/null", { encoding: "utf-8" }).trim(), "bestwork-agent", "hooks", "bestwork-hud.mjs");
  if (existsSync(npmHud)) {
    hudSrc = npmHud;
  } else {
    // Plugin cache
    try {
      const cacheDir = execSync("ls -d ~/.claude/plugins/cache/bestwork-tools/bestwork-agent/*/hooks 2>/dev/null | sort -V | tail -1", { encoding: "utf-8", shell: "/bin/bash" }).trim();
      const cacheHud = join(cacheDir, "bestwork-hud.mjs");
      if (cacheDir && existsSync(cacheHud)) hudSrc = cacheHud;
    } catch {}
  }

  if (hudSrc) {
    await copyFile(hudSrc, join(bwDir, "hud.mjs"));
  }

  const existingStatusLine = settings.statusLine as Record<string, unknown> | string | undefined;
  const isBestworkHud = typeof existingStatusLine === "object"
    ? (typeof existingStatusLine?.command === "string" && existingStatusLine.command.includes("bestwork"))
    : (typeof existingStatusLine === "string" && existingStatusLine.includes("bestwork"));

  if (!existingStatusLine || isBestworkHud) {
    settings.statusLine = { type: "command", command: "node ~/.bestwork/hud.mjs" };
  }

  // Auto-register bestwork permissions
  const permissions = (settings.permissions ?? {}) as Record<string, unknown>;
  const allow = (permissions.allow ?? []) as string[];
  const bestworkPerms = [
    "Bash(bestwork:*)",
    "Bash(curl *discord.com*)",
    "Bash(curl *hooks.slack.com*)",
    "Bash(curl *api.telegram.org*)",
  ];
  for (const perm of bestworkPerms) {
    if (!allow.includes(perm)) {
      allow.push(perm);
    }
  }
  permissions.allow = allow;
  settings.permissions = permissions;

  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  bwOk(`bestwork installed — ${added} added, ${removed} upgraded`);
  console.log("");
  bwLog("Agent hooks (full LLM with tools):");
  bwLog("  Smart Gateway  — routes ./commands + natural language to agents");
  bwLog("  Validation     — understands code context, checks imports exist");
  bwLog("  Grounding      — verifies file was read before edit");
  bwLog("  Platform Review — scans diff for OS/runtime mismatches on stop");
  console.log("");
  bwLog("Command hooks (fast, no LLM):");
  bwLog("  Event capture  — records tool calls to ~/.bestwork/data/");
  bwLog("  Scope enforce  — blocks edits outside ./scope path");
  bwLog("  Strict enforce — blocks rm -rf, git push --force");
  bwLog("  Slash commands — ./discord, ./slack config");
  bwLog("  Notifications  — rich Discord/Slack on prompt complete");
  console.log("");
  bwLog("Commands:");
  bwLog("  ./trio t1 | t2 | t3   — parallel with Tech+PM+Critic per task");
  bwLog("  ./review              — platform/hallucination check");
  bwLog("  ./scope ./strict ./tdd ./recover ./context");
  bwLog("  ./autopsy ./learn ./predict ./guard ./compare");
  bwLog("  ./discord ./slack     — webhook setup");
  bwLog("  ./help                — list all");
  bwLog("  Or just type naturally — smart gateway routes it");
  console.log("");
  bwOk("Restart Claude Code to activate.");
}
