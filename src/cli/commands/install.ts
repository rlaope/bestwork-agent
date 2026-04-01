import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { ensureDataDir } from "../../data/store.js";

const HOOK_COMMAND = `NYSM_HOOK_EVENT=__EVENT__ bash "$(npm root -g)/nysm/hooks/nysm-hook.sh"`;

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

  // Add PostToolUse hook
  if (!hooks.PostToolUse) hooks.PostToolUse = [];
  const postHooks = hooks.PostToolUse as Array<Record<string, unknown>>;
  const hasPostHook = postHooks.some(
    (h) =>
      Array.isArray(h.hooks) &&
      h.hooks.some(
        (hh: Record<string, unknown>) =>
          typeof hh.command === "string" && hh.command.includes("nysm-hook")
      )
  );

  if (!hasPostHook) {
    postHooks.push({
      hooks: [
        {
          type: "command",
          command: HOOK_COMMAND.replace("__EVENT__", "post"),
          timeout: 5,
        },
      ],
    });
  }

  // Add PreToolUse hook
  if (!hooks.PreToolUse) hooks.PreToolUse = [];
  const preHooks = hooks.PreToolUse as Array<Record<string, unknown>>;
  const hasPreHook = preHooks.some(
    (h) =>
      Array.isArray(h.hooks) &&
      h.hooks.some(
        (hh: Record<string, unknown>) =>
          typeof hh.command === "string" && hh.command.includes("nysm-hook")
      )
  );

  if (!hasPreHook) {
    preHooks.push({
      hooks: [
        {
          type: "command",
          command: HOOK_COMMAND.replace("__EVENT__", "pre"),
          timeout: 5,
        },
      ],
    });
  }

  settings.hooks = hooks;

  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  console.log("\n  nysm hooks installed successfully!\n");
  console.log("  Hooks added to ~/.claude/settings.json:");
  console.log("  • PostToolUse — captures tool results");
  console.log("  • PreToolUse  — captures tool inputs");
  console.log("\n  Data will be stored in ~/.nysm/data/");
  console.log("  Restart Claude Code to activate.\n");
}
