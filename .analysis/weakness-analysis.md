# Competitive Weakness Analysis — BW vs OMC vs OMO

Analyst: sr-backend | Date: 2026-04-03
Source: .analysis/raw-metrics.md (Junior's raw data collection)

---

## Scoring Matrix (1-5, higher = better)

| # | Category | BW | OMC | OMO | BW Gap |
|---|----------|-----|-----|-----|--------|
| 1 | Code quality | 2 | 4 | 4 | -2 |
| 2 | Gateway accuracy | 4 | 3 | 2 | +1.5 avg |
| 3 | Agent system | 5 | 2 | 2 | +3 |
| 4 | Anti-hallucination | 4 | 3 | 2 | +1.5 avg |
| 5 | Observability | 4 | 4 | 3 | 0 vs OMC |
| 6 | Execution modes | 3 | 4 | 5 | -1.5 avg |
| 7 | Developer experience | 3 | 4 | 3 | -1 vs OMC |
| 8 | Extensibility | 2 | 4 | 5 | -2.5 avg |
| 9 | Performance | 5 | 2 | 4 | +2 avg |
| 10 | Distribution | 3 | 3 | 5 | -1 vs OMO |

---

## Category Breakdown

### 1. Code Quality — BW: 2 | OMC: 4 | OMO: 4

**Scoring rationale:**
- BW: 9.7K LOC, 223 test assertions across 12 files. No coverage config. Type safety is there (tsup + tsc --noEmit) but testing depth is shallow.
- OMC: 218K LOC, 6,784 assertions across 404 files. Mature test suite.
- OMO: 208K LOC, 4,783 assertions across 472 files. Strong test culture.

**What BW is missing:**
- Test coverage tooling (no c8/istanbul/vitest coverage configured)
- Test-to-code ratio is 1 test file per ~10 source files. OMC has roughly 1:2, OMO roughly 1:3.
- No integration tests visible — the 12 test files likely cover unit tests only.
- Missing edge case coverage for gateway classification (the most critical path).

**Fix difficulty:** Medium. Adding vitest coverage config is trivial. Writing meaningful tests for classifyIntent and smart-gateway takes real effort.
**Impact:** High. Gateway misclassification directly breaks user experience. Untested code paths will regress.

---

### 2. Gateway Accuracy — BW: 4 | OMC: 3 | OMO: 2

**Scoring rationale:**
- BW: Hybrid regex + rule-based classifier. Action-verb requirement prevents false positives. Bilingual support (EN + KR). Dynamic scaling (1-5 tasks, 1-5 agents). This is a genuine differentiator.
- OMC: Capability scoring with confidence thresholds. More sophisticated mathematically but no bilingual support.
- OMO: No real gateway. Error classifiers only. Hook loader dispatches, not classifies.

BW leads here. No gap to close.

---

### 3. Agent System — BW: 5 | OMC: 2 | OMO: 2

**Scoring rationale:**
- BW: 49 named specialists with role metadata, 16 org roles, editable prompt files, dynamic allocation per task. This is BW's defining feature.
- OMC: Team roles but no named agent specialization. Skill-first, not agent-first.
- OMO: Tool-centric. No agent identity system at all.

BW dominates. No gap to close.

---

### 4. Anti-Hallucination — BW: 4 | OMC: 3 | OMO: 2

**Scoring rationale:**
- BW: Grounding check (Read before Edit), validation hook (tsc + import verification), platform mismatch detection (uname check), scope enforcement, strict enforcement. Five distinct defense layers.
- OMC: Factcheck hook, comment checker, tool pair validator, write guards. Solid but fewer layers.
- OMO: Tool guard hooks, runtime error classifier. Minimal dedicated anti-hallucination.

**What BW is missing (minor):**
- No dedicated write/edit guard (relies on grounding agent instead of hard block). OMC has `write-existing-file-guard` that blocks writes to unread files at the tool level.
- The grounding agent is LLM-based, meaning it costs tokens and can itself hallucinate. A deterministic shell check (did Read happen for this file before Edit?) would be more reliable.

**Fix difficulty:** Easy. A shell hook checking PreToolUse for Edit/Write that verifies a prior Read for the same path in the session log.
**Impact:** Medium. The agent-based approach works but burns tokens and has a non-zero failure rate.

---

### 5. Observability — BW: 4 | OMC: 4 | OMO: 3

**Scoring rationale:**
- BW: HUD (usage API, 90s poll), loop detection, heatmap, replay, analytics aggregation, stats card, Discord/Slack notifications. Unique features: heatmap, replay.
- OMC: 23 HUD elements (agents, autopilot, context, git, model, todos, token-usage, etc.), Slack socket mode with reply listener. Much richer HUD surface area.
- OMO: Session manager/registry/poller. No dedicated HUD. Notification via hooks.

**What BW is missing:**
- HUD element count is severely behind OMC (1 usage element vs 23 rich elements covering git state, context window, model info, todo tracking, autopilot status).
- No real-time Slack interaction (OMC has socket mode + reply listener; BW only sends outbound webhooks).
- No git-aware HUD (current branch, dirty state, commit info).
- No context window tracking in HUD (how much context is consumed).

**Fix difficulty:** Medium. HUD elements are individually easy but designing 10+ coherent elements takes time. Slack socket mode is harder.
**Impact:** High. Power users live in the HUD. A single-element HUD looks thin next to OMC's 23 elements.

---

### 6. Execution Modes — BW: 3 | OMC: 4 | OMO: 5

**Scoring rationale:**
- BW: Dynamic scaling (solo/pair/trio/squad/hierarchy), parallel task allocation via gateway. Plan confirmation via AskUserQuestion. No persistent/background execution.
- OMC: Team dispatch queue with governance. Background task tracking.
- OMO: Native binaries, tmux subagents (true parallel processes), LSP integration, delegate-task with sync session poller, run continuation state. Most sophisticated execution model.

**What BW is missing:**
- No persistent/background agent execution. When a BW session ends, all state is cold. OMO's run-continuation-state lets agents resume.
- No true parallel process execution. BW's "parallel" is sequential within a single Claude Code session — it allocates multiple agents but they execute one-at-a-time. OMO uses tmux to spawn actual parallel subagents.
- No autonomous mode. OMC has autopilot-like governance; OMO has delegate-task. BW always requires the user to be in-session.
- No LSP integration for real-time code intelligence during execution.

**Fix difficulty:** Hard. True parallel execution requires spawning subprocesses or tmux sessions. Run continuation requires persistent state across sessions. LSP integration is a significant engineering effort.
**Impact:** High. This is where BW's 9.7K LOC shows its limits. Complex multi-task work genuinely benefits from parallel execution.

---

### 7. Developer Experience — BW: 3 | OMC: 4 | OMO: 3

**Scoring rationale:**
- BW: Two install paths (npm global + plugin), `bestwork install` CLI, /onboard skill, /doctor skill. Decent but docs quality varies.
- OMC: Multi-level config (global/project/local), template-based hooks, more mature npm package with multiple bin entries (oh-my-claudecode, omc, omc-cli).
- OMO: Complex monorepo setup, native binary distribution. Powerful but steep learning curve.

**What BW is missing:**
- No multi-level config hierarchy. BW has global + project, but no local (per-directory) override. OMC's three-tier config is more flexible.
- No config schema validation. OMO has 30+ config schema files ensuring valid configuration.
- Onboarding flow exists (/onboard) but first-run experience depends on user finding it. No auto-onboarding on first `bestwork install`.
- 17 skills with no discoverability beyond `/bestwork-agent:agents`. No skill search, no fuzzy matching, no "did you mean...?" suggestions.

**Fix difficulty:** Easy to Medium. Config hierarchy and schema validation are well-understood patterns. Auto-onboarding is trivial.
**Impact:** Medium. First impressions matter. A user who installs BW and gets no guidance will churn.

---

### 8. Extensibility — BW: 2 | OMC: 4 | OMO: 5

**Scoring rationale:**
- BW: 0 custom tools. Skills are plugin-registered but not user-extensible. No MCP integration. No plugin loader for third-party extensions.
- OMC: 28 custom tools. Template-based hooks. Richer skill system (31 skills).
- OMO: 16 tool systems (203 tool files). Plugin skill loader for third-party skills. Hook loader for dynamic hook registration. 48+ hook categories.

**What BW is missing:**
- Zero custom tools. This is the single biggest extensibility gap. OMC has 28, OMO has 203 tool files. BW agents operate entirely through Claude Code's built-in tools.
- No plugin/extension loader. Users cannot add their own skills or hooks without forking the repo.
- No MCP (Model Context Protocol) integration. No way to connect BW agents to external data sources or tool providers.
- No hook registration API. Hooks are hardcoded in hooks.json. Adding a new hook requires modifying the source.
- No tool-use middleware. Cannot intercept, transform, or augment tool calls.

**Fix difficulty:** Hard. A plugin loader requires defining a stable API surface, versioning, discovery, and loading mechanism. MCP integration is a protocol implementation. Custom tools require Claude Code's tool registration interface.
**Impact:** High. Extensibility is what turns a tool into a platform. Without it, BW stays a closed system that can only grow through core development.

---

### 9. Performance — BW: 5 | OMC: 2 | OMO: 4

**Scoring rationale:**
- BW: 564K bundle, 3 JS files, 5 dependencies. Minimal footprint. Fast startup.
- OMC: 23M bundle, 825 JS files, 12 dependencies. Heavy. Slow to load.
- OMO: Native binaries (platform-specific). Fast runtime but large download. 16 dependencies.

BW leads decisively. No gap to close.

---

### 10. Distribution — BW: 3 | OMC: 3 | OMO: 5

**Scoring rationale:**
- BW: npm global + Claude Code plugin marketplace. Two channels.
- OMC: npm global with 3 bin aliases. Single channel but good ergonomics.
- OMO: npm global + native binaries for 11 platforms (darwin/linux/windows, arm64/x64). Best cross-platform story.

**What BW is missing:**
- No native binary distribution. Users must have Node.js installed.
- No platform-specific packages. BW assumes a Node.js runtime everywhere.
- No offline/airgapped install option.
- Plugin marketplace path depends on Claude Code's plugin system stability (not under BW's control).

**Fix difficulty:** Medium to Hard. Native binaries require a build pipeline (pkg, bun compile, or similar). Platform packages require CI/CD for each target.
**Impact:** Medium. Most Claude Code users already have Node.js. But native binaries eliminate "works on my machine" issues and simplify enterprise deployment.

---

## Final Ranking

### BW's Top 3 Strengths (beats both OMC and OMO)

1. **Agent system (5 vs 2 vs 2)** — 49 named specialists with role metadata, dynamic allocation, org hierarchy. Neither competitor has anything close to this depth of agent identity and selection intelligence. This is BW's moat.

2. **Performance (5 vs 2 vs 4)** — 564K bundle vs OMC's 23M. 40x smaller. 3 files vs 825. BW proves you don't need 200K+ LOC to build a capable agent harness. Every millisecond of startup time matters when the gateway runs on every single prompt.

3. **Gateway accuracy (4 vs 3 vs 2)** — Hybrid classification with action-verb gating, bilingual routing, and dynamic task-to-agent allocation. The only harness that handles Korean prompts. The false-positive defense (requiring action verbs) is simple but effective.

### BW's Top 5 Weaknesses (loses to both OMC and OMO)

1. **Extensibility (BW: 2 vs OMC: 4 vs OMO: 5)** — This is the most critical gap. Zero custom tools, no plugin loader, no MCP, no hook registration API. BW is a closed box. Users cannot extend it without forking. In the Claude Code ecosystem, tools and plugins are how value compounds. Without extensibility, BW's 49 agents are smart but have no hands.

2. **Code quality / test depth (BW: 2 vs OMC: 4 vs OMO: 4)** — 223 test assertions vs 6,784 (OMC) and 4,783 (OMO). The ratio is 30:1 against. No coverage tooling. For a project where gateway misclassification breaks every interaction, this is dangerous. The test suite does not match the ambition of the agent system.

3. **Execution modes (BW: 3 vs OMC: 4 vs OMO: 5)** — No true parallel execution (agents are sequential within one session), no persistent/background agents, no run continuation, no autonomous mode. BW's "squad" and "hierarchy" modes are organizational metaphors, not execution primitives. OMO's tmux subagents deliver actual parallelism.

4. **Developer experience (BW: 3 vs OMC: 4 vs OMO: 3)** — Loses to OMC specifically on config hierarchy (2-tier vs 3-tier), config validation (none vs schema-based), and skill discoverability. The gap is not enormous but it compounds over daily use.

5. **Observability HUD depth (BW: 4 vs OMC: 4, but qualitatively behind)** — BW ties OMC numerically but loses on HUD richness: 1 usage element vs 23 elements. BW compensates with unique features (heatmap, replay) but the moment-to-moment HUD experience is thinner. No git state, no context window tracking, no todo status in the statusline.

---

## Priority Fix Recommendations

| Rank | Weakness | Fix | Effort | Impact |
|------|----------|-----|--------|--------|
| 1 | Extensibility — no custom tools or plugin loader | Design a tool registration interface + plugin loader pattern | Hard | High |
| 2 | Test depth — 223 assertions for critical gateway | Add gateway classification tests (50+ intent patterns), integration tests | Medium | High |
| 3 | Execution — no true parallelism | Investigate tmux/subprocess spawning for parallel agent execution | Hard | High |
| 4 | HUD richness — 1 element vs 23 | Add 5-8 HUD elements: git, context, model, active-agent, task-progress | Medium | Medium |
| 5 | Extensibility — no MCP | Add MCP client support so agents can access external tools/data | Hard | High |
| 6 | DX — no config schema validation | Add JSON schema for config.json + validation on load | Easy | Medium |
| 7 | Anti-hallucination — LLM-based grounding | Add deterministic Read-before-Edit shell check alongside agent check | Easy | Medium |
| 8 | DX — no auto-onboarding | Trigger /onboard automatically on first `bestwork install` | Easy | Low |

---

## Honest Summary

BW is a lean, opinionated agent harness with genuine innovation in agent identity, classification accuracy, and bundle efficiency. Its 49-specialist system is unique in the ecosystem and its gateway is the most accurate prompt classifier of the three.

But it is architecturally limited by its closed extensibility model and shallow test coverage. The "agent-first" approach gives it identity and intelligence, but without custom tools or a plugin system, those agents can only use Claude Code's built-in capabilities. OMC's agents have 28 custom tools to work with. OMO's have 203.

The execution model is the other structural limitation. BW's team modes (trio/squad/hierarchy) are conceptual overlays on sequential execution, not genuine concurrency primitives. For single-task work this is fine. For the multi-file, multi-concern work that squad/hierarchy modes imply, the lack of true parallelism is a real bottleneck.

BW's path forward is clear: keep the agent system and gateway (they are best-in-class), fix the extensibility and test gaps, and invest in true parallel execution. The 564K bundle proves the architecture is efficient — the question is whether it can grow without losing that efficiency.
