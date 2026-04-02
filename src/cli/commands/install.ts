import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { ensureDataDir } from "../../data/store.js";

const NPM_ROOT = `$(npm root -g)/nysm/hooks`;
const HOOKS_REGISTRY = [
  // PostToolUse
  { event: "PostToolUse", id: "nysm-hook", command: `NYSM_HOOK_EVENT=post bash "${NPM_ROOT}/nysm-hook.sh"`, timeout: 5 },
  { event: "PostToolUse", id: "nysm-validate", command: `bash "${NPM_ROOT}/nysm-validate.sh"`, timeout: 15, matcher: "Write|Edit" },
  // PreToolUse
  { event: "PreToolUse", id: "nysm-hook-pre", command: `NYSM_HOOK_EVENT=pre bash "${NPM_ROOT}/nysm-hook.sh"`, timeout: 5 },
  { event: "PreToolUse", id: "nysm-ground", command: `bash "${NPM_ROOT}/nysm-ground.sh"`, timeout: 5, matcher: "Write|Edit" },
  { event: "PreToolUse", id: "nysm-scope-enforce", command: `bash "${NPM_ROOT}/nysm-scope-enforce.sh"`, timeout: 3, matcher: "Write|Edit" },
  { event: "PreToolUse", id: "nysm-strict-enforce", command: `bash "${NPM_ROOT}/nysm-strict-enforce.sh"`, timeout: 3 },
  // UserPromptSubmit — single smart gateway handles all routing
  { event: "UserPromptSubmit", id: "nysm-smart-gateway", command: `bash "${NPM_ROOT}/nysm-smart-gateway.sh"`, timeout: 15 },
  // Stop
  { event: "Stop", id: "nysm-prompt-done", command: `bash "${NPM_ROOT}/nysm-prompt-done.sh"`, timeout: 20 },
];

// Old hooks to remove (replaced by smart-gateway)
const DEPRECATED_IDS = ["nysm-gateway", "nysm-slash", "nysm-agents", "nysm-harness"];

function hasHook(hookArray: Array<Record<string, unknown>>, id: string): boolean {
  return hookArray.some(
    (h) =>
      Array.isArray(h.hooks) &&
      h.hooks.some(
        (hh: Record<string, unknown>) =>
          typeof hh.command === "string" && hh.command.includes(id)
      )
  );
}

function removeHook(hookArray: Array<Record<string, unknown>>, id: string): Array<Record<string, unknown>> {
  return hookArray.filter(
    (h) =>
      !Array.isArray(h.hooks) ||
      !h.hooks.some(
        (hh: Record<string, unknown>) =>
          typeof hh.command === "string" && hh.command.includes(id)
      )
  );
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
      if (hasHook(arr, id)) {
        hooks[event] = removeHook(arr, id);
        removed++;
      }
    }
  }

  // Add current hooks
  for (const reg of HOOKS_REGISTRY) {
    if (!hooks[reg.event]) hooks[reg.event] = [];
    const arr = hooks[reg.event] as Array<Record<string, unknown>>;

    if (!hasHook(arr, reg.id)) {
      const entry: Record<string, unknown> = {
        hooks: [{ type: "command", command: reg.command, timeout: reg.timeout }],
      };
      if (reg.matcher) entry.matcher = reg.matcher;
      arr.push(entry);
      added++;
    }
  }

  settings.hooks = hooks;
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  console.log(`\n  nysm installed — ${added} added, ${removed} upgraded\n`);
  console.log("  Harness:");
  console.log("    ./scope <path>           — lock edits to directory");
  console.log("    ./strict / ./relax       — guardrails on/off");
  console.log("    ./tdd <desc>             — test-driven development");
  console.log("    ./context [files]        — preload files");
  console.log("    ./recover                — reset when stuck");
  console.log("    ./review                 — platform/hallucination check");
  console.log("    ./trio t1 | t2 | t3      — parallel with Tech+PM+Critic per task");
  console.log("");
  console.log("  Agents:");
  console.log("    ./autopsy [id]           — session post-mortem");
  console.log("    ./learn                  — prompting rules from history");
  console.log("    ./predict <task>         — complexity estimate");
  console.log("    ./guard                  — session health check");
  console.log("");
  console.log("  Notifications:");
  console.log("    ./discord <url>          — Discord webhook");
  console.log("    ./slack <url>            — Slack webhook");
  console.log("    Rich summaries: prompt, stats, git diff, review, health");
  console.log("");
  console.log("  Smart Gateway:");
  console.log("    Natural language works — '코드 리뷰해줘', 'detect loops', etc.");
  console.log("");
  console.log("  Restart Claude Code to activate.\n");
}
