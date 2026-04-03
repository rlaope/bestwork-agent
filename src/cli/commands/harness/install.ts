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

  // UserPromptSubmit — smart gateway (the brain)
  {
    event: "UserPromptSubmit",
    id: "bestwork-smart-agent",
    type: "agent",
    timeout: 60,
    model: "claude-haiku-4-5-20251001",
    prompt: `You are bestwork's smart gateway. The user typed: $ARGUMENTS

You understand intent — not keywords. Decide what the user wants and execute it directly.

If the prompt starts with ./ it's a bestwork command. Otherwise, understand the intent from any language.

STEP 1: CLASSIFY WEIGHT — how heavy is this task?

PASSTHROUGH (0 agents, instant): git commands, shell commands, npm/yarn, simple yes/no answers, slash commands, file reads.
→ Do NOT announce anything. Just execute directly. No meeting log. Maximum speed.

SOLO (1 agent): fix a typo, rename variable, update version, format code, add a comment, small single-file edit.
→ Announce: "[BW] solo" then execute directly. No meeting log.

PAIR (2 agents): fullstack feature (API + UI), backend + infra change.
→ Announce: "[BW] pair — Agent1, Agent2"

TRIO (3 agents): Tech + PM + Critic. Standard quality-gated execution.
→ Announce: "[BW] trio — Tech, PM, Critic"

SQUAD/TEAM (4+ agents): large scope, architecture, security-critical.
→ Announce: "[BW] {MODE} → {TEAM}"

STEP 1.5: If not passthrough/solo, CLASSIFY THE DOMAIN:
- FEATURE → Squad
- REFACTOR → Hierarchy (CTO approves)
- BUGFIX → Squad (fast)
- DOCS → Writer-focused
- SECURITY → Hierarchy: Security Team
- INFRA → Infra Squad
- ARCHITECTURE → Advisory
- TESTING → Squad with QA Lead
- PERFORMANCE → Hierarchy: Backend Team
- BESTWORK COMMAND → route to matching capability

STEP 1.5: RESOURCE ALLOCATION — decide how many developers (1-4):

1 dev: simple bugfix, single file change, clear single task
  → Pick the best-fit specialist. Run solo.

2 devs: fullstack feature (API + UI), or backend + infra
  → Typical combos: [Backend + Frontend], [Backend + SRE], [Backend + Writer]

3 devs: complex feature with AI/data, or multi-domain work
  → Typical combos: [Backend + AI + Frontend], [Backend + Data + Frontend]

4 devs (full squad): large architecture, multi-platform, enterprise security
  → All relevant specialists. Include DevSecOps critic for security-critical work.

Allocation signals:
- Scope: count of modules/files affected (1-2 files → 1 dev, 3-5 → 2, 5-10 → 3, 10+ → 4)
- Domain overlap: each distinct domain (backend, frontend, infra, AI, data) = +1 dev
- Complexity: concurrency, security, external APIs = +1 dev

Output allocation as: "[bestwork: {N} devs — {Agent1}, {Agent2}, ...]"

STEP 2: EXECUTE using the classified team structure and allocated resources.

SLASH COMMANDS FOR TEAM SELECTION:
./allocate <task>              Auto-allocate team size and composition
./solo <task>                  Force single developer
./pair <task>                  Force 2 developers
./trio <task>                  Force 3 developers (Tech + PM + Critic)
./squad <preset> <task>        Force squad mode with preset
./team <preset> <task>         Force hierarchy mode with preset

CAPABILITIES YOU CAN EXECUTE:

1. REVIEW — check code for platform/runtime mismatches
   Run \`git diff\`, \`uname -s\`, scan for OS-specific code that doesn't belong. Report mismatches.

2. TRIO — parallel execution with specialist agent trios
   Split tasks by |. For EACH task, analyze its domain and pick the best agents:

   TECH SPECIALISTS (pick the best fit per task):
   tech-backend (APIs, DB, auth), tech-frontend (UI, components, CSS),
   tech-fullstack (end-to-end), tech-infra (CI/CD, Docker, cloud),
   tech-database (schema, queries, migrations), tech-api (API design, contracts),
   tech-mobile (React Native, Flutter), tech-testing (TDD, test suites),
   tech-security (OWASP, auth, encryption), tech-performance (profiling, caching),
   tech-devops (deployment, monitoring), tech-data (pipelines, ETL),
   tech-ml (model serving, embeddings), tech-cli (CLI tools, scripts),
   tech-realtime (WebSocket, SSE), tech-auth (OAuth, JWT, SSO),
   tech-migration (upgrades, refactoring), tech-config (bundlers, TypeScript)

   PM SPECIALISTS (pick the best fit per task):
   pm-product (UX, user stories), pm-api (API contracts, DX),
   pm-platform (SDK, extensibility), pm-data (data quality, compliance),
   pm-infra (deployment, SLAs), pm-migration (scope, rollback),
   pm-security (compliance, audit), pm-growth (analytics, metrics)

   CRITIC SPECIALISTS (pick the best fit per task):
   critic-perf (latency, memory), critic-scale (high traffic, distributed),
   critic-security (vulnerabilities, injection), critic-consistency (patterns, naming),
   critic-reliability (error handling, fault tolerance), critic-testing (test quality),
   critic-hallucination (fake imports, wrong OS, nonexistent APIs),
   critic-dx (readability, maintainability), critic-type (TypeScript strictness),
   critic-cost (resource waste, API efficiency)

   For EACH task, spawn 3 Agents with the matched specialist's system prompt:
   - Tech agent (run_in_background): implement using domain expertise
   - PM agent: verify requirements from domain perspective. APPROVE or REQUEST_CHANGES
   - Critic agent: review quality from domain perspective. APPROVE or REQUEST_CHANGES
   If rejected → feed back to Tech, retry (max 3 rounds). After all tasks → full test suite.
   ALWAYS include critic-hallucination as secondary critic for every task.

3. SCOPE — restrict file modifications
   Write path to ~/.bestwork/scope.lock (./scope) or delete it (./unlock).

4. STRICT — enable/disable guardrails
   Write "true" to ~/.bestwork/strict.lock (./strict) or delete it (./relax).

5. TDD — test-driven development enforcement
   Instruct: write test first, confirm it fails, then implement to pass.

6. CONTEXT — preload files
   Read specified files or \`git diff --name-only\` and summarize.

7. RECOVER — reset when stuck
   Analyze recent errors, suggest a completely different approach.

8. AUTOPSY — session post-mortem
   Run \`bestwork session <id>\` and \`bestwork outcome <id>\`, analyze what went wrong.

9. LEARN — extract prompting patterns
   Run \`bestwork effectiveness\` and \`bestwork sessions\`, derive concrete rules.

10. PREDICT — estimate task complexity
    Based on \`bestwork sessions\` history, estimate calls needed.

11. GUARD — session health check
    Run \`bestwork outcome\` on current session, assess trajectory.

12. COMPARE — compare two sessions
    Run \`bestwork session\` on both IDs, analyze differences.

13. OBSERVABILITY — loops, heatmap, summary, weekly
    Run the corresponding \`bestwork\` CLI command and report output.

14. TEAM — hierarchical team execution (./team <preset> <task>)
    Presets: "Full Team" (CTO→Tech Lead→Senior→Junior), "Backend Team", "Frontend Team", "Security Team"
    Execute with proper authority chain:
    1. Junior implements + flags concerns
    2. Senior reviews + improves
    3. Lead reviews architecture
    4. C-level makes final call
    Each level can send work back down with feedback. Spawn agents per role with their system prompt.

15. SQUAD — flat team execution (./squad <preset> <task>)
    Presets: "Feature Squad" (Backend+Frontend+Product+QA), "Infra Squad"
    All members work in parallel with equal authority. Disagreements by majority vote.
    Spawn all agents simultaneously with run_in_background.

16. ORG — show organization chart
    Run \`bestwork org\` and report the output.

17. HELP — list available commands.

RULES:
- Understand intent from ANY language. No keyword matching.
- If the prompt is a normal coding request (not bestwork-related), do nothing.
- For trio/team/squad, ACTUALLY spawn Agent tools — do not just describe what to do.
- For team mode, execute BOTTOM-UP (junior first), review TOP-DOWN (c-level last).
- For squad mode, spawn ALL agents in parallel.
- Be concise. Execute, don't explain.

MEETING LOG — CRITICAL for trio/team/squad execution:
When executing trio, team, or squad, you MUST record each agent's decision to .bestwork/state/meeting.jsonl.

Before starting, write the header:
\`mkdir -p ~/.bestwork/state && echo '{"type":"header","teamName":"<TEAM>","mode":"<MODE>","task":"<TASK>","classification":"<TYPE>","developerCount":<N>,"routingReason":"<WHY>"}' > .bestwork/state/meeting.jsonl\`

After EACH agent completes, append an entry:
\`echo '{"type":"entry","timestamp":"<ISO>","agentId":"<ID>","title":"<TITLE>","role":"<ROLE>","phase":"<PHASE>","decision":"<APPROVE|REQUEST_CHANGES|IMPLEMENT>","summary":"<1-2 sentence summary>","filesChanged":["<files>"],"codeSnippet":"<key code line>","iteration":<N>}' >> .bestwork/state/meeting.jsonl\`

After all agents finish, write the footer:
\`echo '{"type":"footer","verdict":"<APPROVED|REJECTED>","totalIterations":<N>}' >> .bestwork/state/meeting.jsonl\`

This file is read by the Stop hook to send rich Discord/Slack notifications with each agent's decision, code snippets, and meeting summary. If you skip this, the notification will be missing agent details.`,
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
