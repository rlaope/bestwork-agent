import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { ensureDataDir } from "../../data/store.js";

const NPM_ROOT = `$(npm root -g)/nysm/hooks`;
const HOOKS_REGISTRY = [
  // PostToolUse hooks
  { event: "PostToolUse", id: "nysm-hook", command: `NYSM_HOOK_EVENT=post bash "${NPM_ROOT}/nysm-hook.sh"`, timeout: 5 },
  { event: "PostToolUse", id: "nysm-validate", command: `bash "${NPM_ROOT}/nysm-validate.sh"`, timeout: 15, matcher: "Write|Edit" },
  // PreToolUse hooks
  { event: "PreToolUse", id: "nysm-hook-pre", command: `NYSM_HOOK_EVENT=pre bash "${NPM_ROOT}/nysm-hook.sh"`, timeout: 5 },
  { event: "PreToolUse", id: "nysm-ground", command: `bash "${NPM_ROOT}/nysm-ground.sh"`, timeout: 5, matcher: "Write|Edit" },
  // UserPromptSubmit hooks
  { event: "UserPromptSubmit", id: "nysm-gateway", command: `bash "${NPM_ROOT}/nysm-gateway.sh"`, timeout: 10 },
  { event: "UserPromptSubmit", id: "nysm-slash", command: `bash "${NPM_ROOT}/nysm-slash.sh"`, timeout: 10 },
  // Stop hooks
  { event: "Stop", id: "nysm-prompt-done", command: `bash "${NPM_ROOT}/nysm-prompt-done.sh"`, timeout: 15 },
];

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

  console.log(`\n  nysm installed — ${added} new hook(s) added\n`);
  console.log("  Hooks:");
  console.log("  • PostToolUse    — event capture + auto typecheck on Edit/Write");
  console.log("  • PreToolUse     — event capture + grounding check (Read before Edit)");
  console.log("  • UserPromptSubmit — slash commands (./discord, ./slack) + gateway");
  console.log("  • Stop           — prompt completion notifications");
  console.log("");
  console.log("  Slash commands (type in Claude Code):");
  console.log("    ./discord <webhook_url>  — enable Discord notifications");
  console.log("    ./slack <webhook_url>    — enable Slack notifications");
  console.log("    ./nysm                   — check nysm status");
  console.log("");
  console.log("  Anti-hallucination:");
  console.log("    Grounding — warns when editing files not yet Read in session");
  console.log("    Validate  — auto typecheck after code changes");
  console.log("");
  console.log("  Restart Claude Code to activate.\n");
}
