# Improvement Plan — bestwork-agent

Date: 2026-04-03
Source: .analysis/weakness-analysis.md, .analysis/raw-metrics.md

---

## Priority 1: Critical (this week)

### 1.1 MCP Server for Custom Tools (Extensibility)

**What:** Add an MCP server to bestwork-agent that exposes custom tools Claude Code can call. OMC already does this -- `plugin.json` supports `mcpServers` pointing to a `.mcp.json` file, and Claude Code spawns the server automatically.

**Why this works:** Claude Code plugins support `"mcpServers": "./.mcp.json"` in plugin.json. The MCP server runs as a child process and registers tools via the MCP protocol. This is NOT a hypothetical feature -- OMC ships `bridge/mcp-server.cjs` doing exactly this today.

**What tools to expose (start with 5):**
1. `bestwork_plan` -- Generate an execution plan for a prompt (wraps classifyIntent + buildExecutionPlan). Gives agents a way to programmatically decompose tasks.
2. `bestwork_agents` -- Query the agent catalog with filters (domain, role type, skill). Returns agent metadata without needing the /agents skill.
3. `bestwork_meeting_log` -- Read/append to `.bestwork/state/meeting.jsonl`. Agents can review past meeting decisions.
4. `bestwork_session_stats` -- Return current session analytics (from observe/aggregator). Gives agents self-awareness of their performance.
5. `bestwork_heatmap` -- Query file change heatmap data. Agents can see which files are most actively modified.

**Files to create/modify:**
- Create `src/mcp/server.ts` -- MCP server entry point using `@modelcontextprotocol/sdk`
- Create `src/mcp/tools/plan.ts`, `agents.ts`, `meeting.ts`, `stats.ts`, `heatmap.ts` -- tool handlers
- Create `.mcp.json` -- MCP server config `{"mcpServers":{"bestwork":{"command":"node","args":["${CLAUDE_PLUGIN_ROOT}/dist/mcp-server.js"]}}}`
- Modify `.claude-plugin/plugin.json` -- add `"mcpServers": "./.mcp.json"`
- Modify `tsup.config.ts` -- add `mcp-server.ts` as a fourth entry point

**Estimated effort:** 12-16 hours

**Impact on scoring gap:** Extensibility moves from 2 to 3.5. Five real tools vs zero. Still behind OMC (28) and OMO (203) but no longer zero. The MCP pattern also makes adding future tools trivial (each is a handler file).

---

### 1.2 Test Coverage for Gateway + Orchestrator (Test Depth)

**What:** Triple the test assertion count by targeting the most critical and currently untested paths.

**Modules with ZERO test coverage:**
- `src/harness/meeting-log.ts` -- meeting state persistence
- `src/harness/meeting-state.ts` -- meeting state management
- `src/harness/session-recovery.ts` -- session recovery logic
- `src/harness/prompt-loader.ts` -- prompt file loading
- `src/harness/notify-on-complete.ts` -- notification dispatch
- `src/harness/task-classifier.ts` -- task classification (separate from orchestrator)
- `src/observe/outcomes.ts` -- outcome tracking
- `src/observe/effectiveness.ts` -- effectiveness scoring
- `src/observe/stats-card.ts` -- stats card rendering
- `src/observe/replay.ts` -- replay system
- `src/data/store.ts` -- data persistence
- All 49 individual agent files (`src/harness/agents/tech/*.ts`, `pm/*.ts`, `critic/*.ts`)

**Test types missing:**
- Integration tests: gateway stdin/stdout end-to-end (only smart-gateway.test.ts does this, but with 30 cases; need 100+)
- Snapshot tests: agent prompt outputs, stats card rendering, HUD output format
- Error/edge tests: malformed config, missing files, concurrent writes to meeting.jsonl
- Regression tests: specific bugs that were fixed (the gateway classification improvements in recent commits)

**Files to create:**
- `src/harness/__tests__/meeting-log.test.ts` -- CRUD on meeting.jsonl
- `src/harness/__tests__/meeting-state.test.ts` -- state transitions
- `src/harness/__tests__/prompt-loader.test.ts` -- prompt loading + fallbacks
- `src/harness/__tests__/task-classifier.test.ts` -- classification edge cases
- `src/harness/__tests__/notify.test.ts` -- config loading, webhook URL validation
- `src/observe/__tests__/outcomes.test.ts` -- outcome tracking
- `src/observe/__tests__/effectiveness.test.ts` -- scoring accuracy
- `src/observe/__tests__/stats-card.test.ts` -- snapshot tests for card rendering
- `src/observe/__tests__/replay.test.ts` -- replay parsing
- `src/data/__tests__/store.test.ts` -- data persistence

**Files to modify:**
- `vitest.config.ts` -- add coverage config (`coverage: { provider: 'v8', reporter: ['text', 'lcov'] }`)
- `package.json` -- add `@vitest/coverage-v8` to devDependencies, add `"test:coverage"` script

**Estimated effort:** 16-20 hours (spread across the week)

**Impact on scoring gap:** Test assertions go from 223 to ~600-700. Code quality score moves from 2 to 3. Still behind OMC (6,784) but the test-to-code ratio becomes reasonable (1 test file per ~5 source files instead of 1:10). Coverage tooling makes future gaps visible.

---

### 1.3 Deterministic Read-before-Edit Guard (Anti-Hallucination)

**What:** Replace the LLM-based grounding agent with a deterministic shell hook that checks whether a file was Read before Edit/Write. The current agent-based approach burns tokens and can itself hallucinate.

**How:** A shell hook on PreToolUse for Write|Edit that:
1. Parses `$ARGUMENTS` to extract the target file path
2. Checks `.bestwork/state/reads.log` (a simple append-log of Read tool calls, written by the PostToolUse shell hook)
3. If the file was NOT read in this session, outputs a blocking message
4. If read, exits silently

**Files to create/modify:**
- Create `hooks/bestwork-grounding-guard.sh` -- deterministic file-read checker
- Modify `hooks/bestwork-hook.sh` -- append Read tool calls to `.bestwork/state/reads.log` on PostToolUse
- Modify `hooks/hooks.json` -- replace the grounding agent with the shell hook (keep the agent as a fallback for complex cases)

**Estimated effort:** 3-4 hours

**Impact on scoring gap:** Anti-hallucination stays at 4 but becomes more reliable. Eliminates token cost from grounding checks. Adds a hard guard alongside the soft agent check.

---

## Priority 2: Important (next 2 weeks)

### 2.1 HUD Multi-Element Expansion (Observability)

**What:** Expand the HUD from 1 element (usage) to 6 elements.

**Reality check on statusLine:** Claude Code's `statusLine` in hooks.json accepts a single string output. It is one line. You cannot show 23 separate HUD elements like OMC does (OMC likely uses a different rendering path or TUI overlay). BW's statusLine must pack information into one dense line.

**Elements users actually want (based on what OMC exposes):**
1. **Usage** (already exists) -- 5h + weekly API usage with reset timer
2. **Git state** -- current branch + dirty/clean + ahead/behind count. `git rev-parse --abbrev-ref HEAD` + `git status --porcelain | wc -l`. Cheap, no API call.
3. **Context window** -- percentage of context consumed. Claude Code passes this in stdin JSON to statusLine hooks. Parse and display.
4. **Active agent** -- which bestwork agent is currently assigned (from gateway's last classification). Read from `.bestwork/state/active-agent.json`.
5. **Session duration** -- how long the current session has been running. Derived from session start timestamp.
6. **Loop warning** -- if loop detector has flagged the current session, show a warning indicator.

**Statusline format example:**
```
BW 1.0 | main+3 | ctx:42% | sr-backend | 23m | $12.40/5h(2h31m)
```

**Files to modify:**
- `hooks/bestwork-hud.mjs` -- add git, context, agent, session, loop sections to the output string
- `hooks/bestwork-hook.sh` -- write active agent to `.bestwork/state/active-agent.json` on gateway classification

**Files to create:**
- None. All changes go into existing HUD script.

**Estimated effort:** 8-10 hours

**Impact on scoring gap:** Observability becomes a clear 4.5 (vs OMC's 4). BW compensates for fewer discrete elements with unique features (heatmap, replay) plus a denser statusline. The qualitative gap shrinks significantly.

---

### 2.2 Config Schema Validation (Developer Experience)

**What:** Add Zod schema validation for both global (`~/.bestwork/config.json`) and project (`.bestwork/config.json`) configs.

**Is Zod worth it?** Yes. BW already has TypeScript interfaces (`BestworkConfig`, `ProjectConfig`, `NotifyConfig` in `src/harness/notify.ts`). Zod would:
- Validate at load time with clear error messages ("config.json: 'defaultMode' must be one of solo|pair|trio|squad|hierarchy, got 'turbo'")
- Generate types from schemas (replace manual interfaces)
- Catch typos in webhook URLs, invalid agent IDs, malformed config

**What about a 3-tier config hierarchy?** Not worth it. BW has global + project, which covers 95% of use cases. Per-directory overrides add complexity with marginal benefit for a harness tool (unlike an editor where per-folder settings matter). Keep 2 tiers.

**Files to create/modify:**
- Create `src/harness/config-schema.ts` -- Zod schemas for BestworkConfig, ProjectConfig, NotifyConfig
- Modify `src/harness/notify.ts` -- replace manual parsing with `configSchema.safeParse()`, emit clear errors
- Modify `package.json` -- add `zod` as a dependency
- Create `src/harness/__tests__/config-schema.test.ts` -- validation edge cases

**Estimated effort:** 6-8 hours

**Impact on scoring gap:** Developer experience moves from 3 to 3.5. Config validation is table stakes for mature tools. The error messages alone prevent hours of debugging.

---

### 2.3 Skill Discoverability (Developer Experience)

**What:** Add fuzzy skill matching and "did you mean?" suggestions when users type unrecognized commands.

**How:** When the gateway receives a prompt that looks like a skill invocation but doesn't match any SKILL_ROUTES pattern:
1. Compute Levenshtein distance against all 17 skill names
2. If distance < 3, suggest the closest match in additionalContext
3. Show all available skills if no close match

**Files to modify:**
- `src/harness/smart-gateway.ts` -- add fuzzy matching after SKILL_ROUTES miss
- Create `src/utils/fuzzy.ts` -- Levenshtein distance function (trivial, ~20 LOC)
- Create `src/utils/__tests__/fuzzy.test.ts` -- distance calculation tests

**Estimated effort:** 4-5 hours

**Impact on scoring gap:** Developer experience moves from 3.5 to 3.75. Small but compounds over daily use. Users stop asking "what skills are available?"

---

### 2.4 Session Persistence via State Files (Execution Modes)

**What:** Add session state persistence so agents can resume context across sessions.

**Reality check on parallelism:** Claude Code's Agent tool IS the parallelism primitive. When BW dispatches trio/squad tasks, Claude Code can use the Agent tool to spawn sub-agents that run concurrently. BW does not need to implement tmux or subprocess spawning -- that is Claude Code's job. What BW IS missing is:

1. **Cross-session state**: When a session ends mid-task, all context is lost. A new session starts cold.
2. **Task continuation**: If a plan has 5 tasks and 3 complete before the session ends, there is no way to resume from task 4.

**What to build:**
- Task execution state file: `.bestwork/state/execution.json` tracking task status (pending/in-progress/done) for the current plan
- On SessionStart hook: check for incomplete execution state, inject "resume from task N" into additionalContext
- On Stop hook: persist current execution state

**Files to create/modify:**
- Create `src/harness/execution-state.ts` -- read/write execution state
- Modify `hooks/bestwork-prompt-done.sh` (Stop hook) -- save execution state
- Modify `hooks/hooks.json` -- SessionStart hook reads execution state and injects resume context
- Create `src/harness/__tests__/execution-state.test.ts`

**Estimated effort:** 8-10 hours

**Impact on scoring gap:** Execution modes moves from 3 to 3.5. Still no true parallel processes (that requires Claude Code to evolve), but cross-session continuity is a genuine capability that OMC and OMO implement and BW lacks.

---

## Priority 3: Nice to Have (backlog)

### 3.1 User-Extensible Skills (Extensibility)

**What:** Allow users to add custom skills by placing SKILL.md files in `.bestwork/skills/` (project) or `~/.bestwork/skills/` (global).

**How:** On build/startup, scan user skill directories and merge with built-in skills. Each user skill is a SKILL.md file (same format as built-in skills). The gateway's skill router would check user skills first, then built-in.

**Files to modify:**
- `src/harness/smart-gateway.ts` -- scan user skill dirs on startup
- `.claude-plugin/plugin.json` -- no change needed (skills are loaded dynamically)

**Estimated effort:** 6-8 hours

**Impact:** Extensibility moves from 3.5 to 4. Users can extend BW without forking.

---

### 3.2 Hook Registration API (Extensibility)

**What:** Allow projects to register custom hooks via `.bestwork/hooks.json` (project-level). These merge with BW's built-in hooks at load time.

**Reality check:** This is hard because Claude Code reads `hooks.json` from the plugin root, not from arbitrary locations. The workaround is: BW's SessionStart hook reads `.bestwork/hooks.json` and injects the custom hook behavior into its own shell hooks (e.g., bestwork-hook.sh checks for project-level hook scripts and runs them). This is not true hook registration but achieves the same user-facing behavior.

**Files to modify:**
- `hooks/bestwork-hook.sh` -- check for and execute `.bestwork/hooks/*.sh`
- Create docs explaining the custom hook format

**Estimated effort:** 6-8 hours

**Impact:** Extensibility moves from 4 to 4.5.

---

### 3.3 Integration Test Suite with Fixture Sessions (Test Depth)

**What:** Create a fixtures directory with recorded Claude Code session JSONs and replay them through the gateway, verifying classification accuracy across 200+ real-world prompts.

**Files to create:**
- `tests/fixtures/sessions/` -- recorded session JSONs
- `tests/integration/gateway-replay.test.ts` -- replays fixtures through classifyIntent
- `tests/integration/hud-output.test.ts` -- snapshot tests for HUD output

**Estimated effort:** 10-12 hours

**Impact:** Test assertions could reach 1,000+. Code quality moves to 3.5.

---

### 3.4 Slack Socket Mode (Observability)

**What:** Upgrade Slack integration from outbound webhooks to socket mode with reply listener, enabling two-way communication (user can reply to notifications and the agent receives the response).

**Reality check:** This requires a persistent process, which BW hooks do not provide. Would need a separate daemon or background node process. Low priority because the current webhook approach covers 90% of notification needs.

**Estimated effort:** 16-20 hours

**Impact:** Observability moves from 4.5 to 5. But effort-to-impact ratio is poor.

---

### 3.5 Auto-Onboarding on First Install (Developer Experience)

**What:** When `bestwork install` runs for the first time (no `~/.bestwork/` directory exists), automatically launch the /onboard skill flow instead of just setting up hooks silently.

**Files to modify:**
- `src/cli/commands/harness/install.ts` -- detect first-run, trigger onboard

**Estimated effort:** 2-3 hours

**Impact:** Developer experience marginally improves. Low effort, low risk.

---

### 3.6 Native Binary Distribution (Distribution)

**What:** Use `bun build --compile` or `pkg` to produce standalone binaries for macOS and Linux.

**Reality check:** BW runs inside Claude Code's plugin system. The binary would only help the `npm global` install path. Plugin users still need the JS bundle. The ROI is questionable unless enterprise/airgap deployment becomes a real use case.

**Estimated effort:** 8-12 hours (plus CI/CD setup)

**Impact:** Distribution moves from 3 to 4. But only matters for a subset of users.

---

## Projected Score After Full Execution

| Category | Current | After P1 | After P2 | After P3 |
|----------|---------|----------|----------|----------|
| Extensibility | 2 | 3.5 | 3.5 | 4.5 |
| Code quality / test depth | 2 | 3 | 3 | 3.5 |
| Execution modes | 3 | 3 | 3.5 | 3.5 |
| Developer experience | 3 | 3 | 3.75 | 4 |
| Observability (HUD) | 4 | 4 | 4.5 | 5 |
| **Avg of top 5 weaknesses** | **2.8** | **3.3** | **3.65** | **4.1** |

---

## Key Constraints Acknowledged

1. **Claude Code plugins cannot register custom tools via plugin.json** -- but they CAN register MCP servers, which provide tools. This is the viable path.
2. **statusLine is a single string** -- BW cannot match OMC's 23 discrete HUD elements. Instead, pack 6 data points into one dense line.
3. **True parallel execution requires Claude Code's Agent tool** -- BW should not try to spawn tmux sessions or subprocesses. The Agent tool is the parallelism primitive. BW's job is to provide the right context and plan for Claude Code to parallelize.
4. **Hooks are loaded from plugin.json at session start** -- BW cannot dynamically register hooks mid-session. Project-level hooks must be called from within BW's existing hook scripts.
5. **No Co-Authored-By in commits** -- per project rules.
