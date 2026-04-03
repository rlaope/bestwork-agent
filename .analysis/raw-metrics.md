# Competitive Raw Metrics — BW vs OMC vs OMO

Collected: 2026-04-03

## Code Metrics

| Metric | BW (bestwork-agent) | OMC (oh-my-claudecode) | OMO (oh-my-openagent) |
|--------|---------------------|------------------------|-----------------------|
| Total TypeScript LOC | 9,735 | 218,226 | 208,225 |
| Total TS files | 118 | 848 | 1,532 |
| Bundle size (dist/) | 564K (3 JS files) | 23M (825 JS files) | N/A (no JS dist; binary packages per-platform) |
| dist entry points | 3 (index.js, smart-gateway.js, notify-on-complete.js) | 1 (index.js) | 1 (index.js, not built) |
| Dependencies | 5 | 12 | 16 |
| DevDependencies | 5 | 13 | 4 |

## Test Metrics

| Metric | BW | OMC | OMO |
|--------|-----|-----|-----|
| Test assertions (it/test calls) | 223 | 6,784 | 4,783 |
| Test files (.test.ts/.spec.ts) | 12 | 404 | 472 |
| Test coverage | Not configured | Not measured | Not measured |

## Agent / Skill System

| Metric | BW | OMC | OMO |
|--------|-----|-----|-----|
| Named specialist agents | 49 (25 tech + 10 pm + 14 critic) | 0 (team roles, not named agents) | 0 (tool-centric, not agent-centric) |
| Org roles | 16 (c-level, leads via org.ts) | N/A | N/A |
| Agent prompt files | 4 (prompts/) | 0 | 0 |
| Skills | 17 (skills/) | 31 (skills/ dirs, excl AGENTS.md) | 8 builtin + plugin skill loader |
| Hook entries (hooks.json) | 11 across 5 events | 11 hooks | 48 hook directories + hook loader |
| Hook event types | 5 (PostToolUse, PreToolUse, UserPromptSubmit, Stop, SessionStart) | Not parsed (template-based) | Dynamic (session, core, skill, tool-guard, transform, continuation hooks) |
| Agent hooks (LLM-based) | 3 (grounding, validation, platform review) | Team leader nudge, learner detection | Agent usage reminder, category skill reminder |
| Tools (custom tool implementations) | 0 | 28 | 16 tool directories (203 tool files) |

## Architecture

| Metric | BW | OMC | OMO |
|--------|-----|-----|-----|
| Build system | tsup | tsup (inferred) | Native binary (platform packages) |
| Build outputs | 3 JS bundles | 1 JS bundle (825 dist files) | 11 platform binaries (darwin/linux/windows) |
| Config system | ~/.bestwork/config.json + .bestwork/ per-project | Multi-level (global, project, local) via src/config/ | Multi-level schema (30+ config schema files) |
| State management | .bestwork/ (project), ~/.bestwork/ (global) | Team state paths, omc-state.ts | boulder-state, run-continuation-state, session-state, plugin-state |
| Distribution | npm global + Claude Code plugin | npm global (oh-my-claudecode, omc, omc-cli bins) | npm global (oh-my-opencode bin) + native binaries |
| Monorepo | No | No | Yes (packages/ for platform binaries) |

## Gateway / Router

| Metric | BW | OMC | OMO |
|--------|-----|-----|-----|
| Classification method | Hybrid: regex (SKILL_ROUTES) + rule-based classifyIntent() | Capability scoring (task-router.ts, role-router.ts) | Error classifiers (model-error, session-status) |
| Gateway entry | smart-gateway.ts (runs on every UserPromptSubmit) | No single gateway; hook-based dispatch | Hook loader + plugin loader |
| Supported languages | English + Korean (bilingual regex patterns) | English | English |
| False positive defense | Action-verb requirement in SKILL_ROUTES regex | Confidence scoring (0-1) in task routing | N/A |
| Dynamic scaling | Yes (1-5 tasks, 1-5 agents per task, auto-allocated) | Team dispatch queue with governance | Delegate-task with sync session poller |
| Plan confirmation | AskUserQuestion for non-solo (user confirms/adjusts) | Team governance gates | N/A |

## Anti-Hallucination

| Metric | BW | OMC | OMO |
|--------|-----|-----|-----|
| Grounding check | Yes (PreToolUse agent: "Read before Edit" enforcement) | Factcheck hook (src/hooks/factcheck/) | No dedicated system |
| Validation hook | Yes (PostToolUse agent: tsc + import verification) | Comment checker, tool pair validator | Tool guard hooks |
| Platform mismatch detection | Yes (Stop agent: uname check vs diff patterns) | No dedicated hook | Runtime fallback error classifier |
| Scope enforcement | Yes (bestwork-scope-enforce.sh on PreToolUse) | No | No |
| Strict enforcement | Yes (bestwork-strict-enforce.sh on PreToolUse) | No | No |
| Write/Edit guard | No (relies on grounding agent) | write-existing-file-guard, bash-file-read-guard | write-existing-file-guard (inferred from hook name) |

## Observability

| Metric | BW | OMC | OMO |
|--------|-----|-----|-----|
| Session tracking | Yes (src/observe/, .bestwork/sessions/) | Yes (session history, session search, session registry) | Yes (session manager, session registry, session poller) |
| HUD / Statusline | Yes (bestwork-hud.mjs, usage API with 90s poll) | Yes (23 HUD elements: agents, autopilot, context, git, model, todos, token-usage, etc.) | No dedicated HUD |
| Loop detection | Yes (src/observe/loop-detector.ts) | Ralph loop hook | Ralph loop hook |
| Heatmap | Yes (src/observe/heatmap.ts) | No | No |
| Replay | Yes (src/observe/replay.ts) | No | No |
| Analytics aggregation | Yes (src/observe/aggregator.ts, effectiveness.ts, outcomes.ts) | Background tasks tracking | Background task with metadata |
| Notification integrations | Discord + Slack (webhook config) | Discord + Slack (socket mode + reply listener) | Notification via session hooks |
| Stats card | Yes (src/observe/stats-card.ts) | Session summary HUD element | No |

## Summary Comparison

| Dimension | BW | OMC | OMO |
|-----------|-----|-----|-----|
| LOC | 9.7K | 218K | 208K |
| Approach | Agent-first (49 specialists) | Skill-first (31 skills) | Tool-first (16 tool systems) |
| Test maturity | 223 assertions / 12 files | 6,784 assertions / 404 files | 4,783 assertions / 472 files |
| Hook sophistication | 11 hooks (3 agent-type) | 11 hooks (template-based) | 48+ hook categories (programmatic) |
| Unique features | Org hierarchy, bilingual routing, heatmap, replay, dynamic agent allocation | Full TUI HUD (23 elements), Slack socket reply, team governance | Native binaries, LSP integration, tmux subagents, plugin ecosystem |
| Bundle efficiency | 564K total | 23M total | Binary per-platform |
