import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { ensureDataDir } from "../../../data/store.js";

const NPM_ROOT = `$(npm root -g)/bestwork-agent/hooks`;

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
  { event: "PostToolUse", id: "bestwork-hook", type: "command", command: `BESTWORK_HOOK_EVENT=post bash "${NPM_ROOT}/bestwork-hook.sh"`, timeout: 5 },
  // PreToolUse — enforcement
  { event: "PreToolUse", id: "bestwork-hook-pre", type: "command", command: `BESTWORK_HOOK_EVENT=pre bash "${NPM_ROOT}/bestwork-hook.sh"`, timeout: 5 },
  { event: "PreToolUse", id: "bestwork-scope-enforce", type: "command", command: `bash "${NPM_ROOT}/bestwork-scope-enforce.sh"`, timeout: 3, matcher: "Write|Edit" },
  { event: "PreToolUse", id: "bestwork-strict-enforce", type: "command", command: `bash "${NPM_ROOT}/bestwork-strict-enforce.sh"`, timeout: 3 },
  // UserPromptSubmit — slash routing (fast, just pattern match + config write)
  { event: "UserPromptSubmit", id: "bestwork-slash", type: "command", command: `bash "${NPM_ROOT}/bestwork-slash.sh"`, timeout: 10 },
  // Stop — notifications (needs curl, not LLM)
  { event: "Stop", id: "bestwork-prompt-done", type: "command", command: `bash "${NPM_ROOT}/bestwork-prompt-done.sh"`, timeout: 20 },
  // SessionStart — update check
  { event: "SessionStart", id: "bestwork-update-check", type: "command", command: `bash "${NPM_ROOT}/bestwork-update-check.sh"`, timeout: 5 },

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
Do NOT fix anything. Only report issues concisely (under 3 lines). If no issues, say nothing.`,
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
If NOT read yet, output a warning: "bestwork grounding: Read this file before editing to avoid hallucinated content."
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

STEP 1: CLASSIFY THE TASK — identify what type of work this is:
- FEATURE (new functionality) → Squad: Feature Squad
- REFACTOR (restructure code) → Hierarchy: Full Team (CTO approves)
- BUGFIX (fix broken behavior) → Squad: Feature Squad (fast)
- DOCS (documentation, i18n) → Writer-focused team. If multiple languages: translate naturally, not literally.
- SECURITY (auth, encryption) → Hierarchy: Security Team (CISO approval)
- INFRA (CI/CD, deploy, Docker) → Squad: Infra Squad
- ARCHITECTURE (system design) → Advisory: Architecture Review
- IDEATION (brainstorm, explore) → Advisory + Junior (fresh ideas)
- TESTING (add/fix tests) → Squad with QA Lead
- PERFORMANCE (optimize, profile) → Hierarchy: Backend Team
- DEVSECOPS (secrets, CVE, license) → Security Team + compliance review
- RELEASE (Dockerfile, CI pipeline) → Infra Squad + DevOps focus
- BESTWORK COMMAND (./ prefix or natural language nysm intent) → route to matching capability

Announce: "[bestwork: {TYPE} → {TEAM} ({MODE})]" then execute.

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
- Be concise. Execute, don't explain.`,
  },

  // Stop — platform review on completion
  {
    event: "Stop",
    id: "bestwork-review-on-stop",
    type: "agent",
    timeout: 30,
    prompt: `You are bestwork's platform review agent. A coding session just completed.
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
  "bestwork-gateway", "bestwork-agents", "bestwork-harness",
  "bestwork-smart-gateway", "bestwork-validate", "bestwork-ground",
  "bestwork-session-end",
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
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  console.log(`\n  bestwork installed — ${added} added, ${removed} upgraded\n`);
  console.log("  Agent hooks (full LLM with tools):");
  console.log("    Smart Gateway  — routes ./commands + natural language to agents");
  console.log("    Validation     — understands code context, checks imports exist");
  console.log("    Grounding      — verifies file was read before edit");
  console.log("    Platform Review — scans diff for OS/runtime mismatches on stop");
  console.log("");
  console.log("  Command hooks (fast, no LLM):");
  console.log("    Event capture  — records tool calls to ~/.bestwork/data/");
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
