# CTO Verdict -- bestwork-agent Competitive Improvement Plan

Date: 2026-04-03
Reviewer: CTO (strategic review)
Source: raw-metrics.md, weakness-analysis.md, improvement-plan.md

---

## Strategic Assessment

### 1. Is the improvement plan realistic?

Mostly yes, with two exceptions.

**Solid calls:**
- MCP server for custom tools (P1.1) is the right move. The Lead correctly identified that Claude Code plugins support `mcpServers` and that OMC already ships one. The 5 initial tools are well-chosen -- they expose BW's unique data (agent catalog, heatmap, meeting logs) rather than reimplementing generic functionality. 12-16 hours is realistic.
- Deterministic grounding guard (P1.3) is a no-brainer. 3-4 hours for a hard safety improvement over a probabilistic one. Should have been done months ago.
- HUD expansion (P2.1) is well-scoped. The Lead correctly recognized that statusLine is a single string and designed around it instead of pretending BW can match OMC's 23 discrete elements. The dense line format (`BW 1.0 | main+3 | ctx:42% | sr-backend | 23m | $12.40/5h(2h31m)`) is practical.
- Config schema validation (P2.2) is right but I would drop Zod. BW has 5 dependencies. Adding Zod for config validation is a dependency-count increase of 20% for something that can be done with a 50-line hand-written validator. BW's competitive advantage includes its 564K bundle. Protect that.

**Overengineered:**
- Session persistence (P2.4) is overengineered for the actual problem. The proposal writes execution state on Stop, reads on SessionStart, and injects resume context. But Claude Code sessions already have conversation history. The real gap is not "resume from task 4" -- it is "remember what happened last session." A simpler solution: write a one-paragraph summary to `.bestwork/state/last-session.md` on Stop, inject it on SessionStart. No JSON schema, no task-status tracking, no complex state machine. 2-3 hours instead of 8-10.
- Slack socket mode (P3.4) was correctly flagged as poor ROI by the Lead. Agree. Kill it entirely (see Kill List).

**Missing:**
- The plan says nothing about the 49 agent prompt files. Only 4 exist in `prompts/`. The raw metrics show 49 named specialists but the prompts directory has 4 files. This means 45 agents are running on inline/default prompts, not the editable `.md` files the architecture promises. This is a credibility gap -- BW's #1 differentiator (49 specialist agents) is hollow if 92% of them lack dedicated prompts. This should be P1 priority.
- No mention of improving the `/doctor` skill to validate the full installation health. Doctor should catch issues like missing prompt files, stale HUD cache, broken webhook configs. This is cheap and directly prevents user frustration.

### 2. Does the plan maintain BW's core differentiator?

Yes. The Lead correctly identified that agent system (5/5) and gateway accuracy (4/5) are BW's moat, and none of the proposed changes dilute them. The MCP tools expose agent catalog and meeting logs -- deepening the agent-first identity rather than pivoting away from it.

One concern: the extensibility push (MCP tools, user skills, hook registration) could shift BW's identity from "opinionated agent harness" to "extensible platform." These are different products. BW should stay opinionated. User-extensible skills (P3.1) are fine. A full hook registration API (P3.2) starts to smell like platform work. Keep it minimal.

### 3. Are we chasing competitors or building something unique?

Mixed. The HUD expansion and config validation are chasing OMC's feature list. The MCP server and test coverage are genuine infrastructure investments. The session persistence is chasing OMO.

The plan needs a clearer answer to: **What does BW do that nobody else can?**

Answer: BW is the only harness that treats Claude Code sessions as team meetings with named specialists who have defined roles, expertise domains, and interaction protocols. The 49-agent system with org hierarchy is unique. The bilingual gateway is unique. The heatmap and replay are unique.

The improvement plan should double down on these. Instead of chasing OMC's 23 HUD elements, invest in making the agent system more visible and useful. Instead of Slack socket mode, make meeting logs searchable and reviewable. Instead of native binaries, make the agent selection more intelligent.

---

## Priority Override

The Lead's ranking was close but wrong on #1 and missing a critical item. Here is the corrected ranking:

| Rank | Item | Why |
|------|------|-----|
| 1 | **Agent prompt completion (45 missing prompts)** | BW's #1 differentiator is 49 specialist agents. 92% have no dedicated prompt. This is the single highest-leverage improvement. Each prompt file takes 30-60 min. Batch the top 15 agents first. |
| 2 | **Test coverage for gateway** (was Lead's #2) | Gateway misclassification breaks every interaction. Agree with Lead. |
| 3 | **Deterministic grounding guard** (was Lead's #7) | 3-4 hours for a hard safety win. This should be higher than anything that takes 8+ hours. |
| 4 | **MCP server with 5 tools** (was Lead's #1) | Important but not more important than the agent prompts that define BW's identity. |
| 5 | **HUD multi-element expansion** (was Lead's #4) | Agree with placement. Dense single-line approach is correct. |
| 6 | **Skill discoverability** (was Lead's DX item) | Cheap, high daily-use impact. |
| 7 | **Simple session summary** (replaces Lead's complex P2.4) | One-paragraph summary on Stop, inject on SessionStart. 2-3 hours. |
| 8 | **Config validation** (was Lead's #6) | Do it without Zod. Hand-written validator, keep deps at 5. |

**What gives the MOST user value for the LEAST effort?**
Deterministic grounding guard (3-4 hours). Every user benefits from fewer hallucinated edits. Zero new dependencies. Zero new concepts. Just a shell script.

**What is the #1 thing that would make a new user choose BW over alternatives?**
The 49 specialist agents with real, distinct, editable prompts. A new user who runs `/bestwork-agent:agents` and sees 49 specialists with genuine expertise profiles -- that is the "wow" moment. But if those agents all behave identically because they lack dedicated prompts, the wow evaporates.

**What is the #1 thing that makes existing users frustrated?**
Gateway misclassification. When the gateway sends a simple task to a squad, or a complex task to solo, the user loses trust. More gateway tests = fewer misclassifications = happier users.

---

## Kill List

### Items to NOT build:

1. **Slack socket mode (P3.4)** -- Requires a persistent daemon process. BW is a hook-based harness, not a long-running service. Outbound webhooks cover 90% of notification needs. The remaining 10% does not justify 16-20 hours and an architectural shift. Kill.

2. **Native binary distribution (P3.6)** -- BW runs inside Claude Code. All Claude Code users have Node.js. The only beneficiaries are hypothetical enterprise/airgap users who do not exist yet. 8-12 hours plus CI/CD maintenance for a distribution channel nobody asked for. Kill.

3. **Hook registration API (P3.2)** -- The Lead's own reality check admitted this is not true hook registration, just a workaround where bestwork-hook.sh runs project-level scripts. This is indistinguishable from telling users to put scripts in `.bestwork/hooks/` and calling it a day. Do not formalize it into an "API" -- just document the convention. Downgrade from 6-8 hours of engineering to 1 hour of documentation.

4. **3-tier config hierarchy** -- The Lead correctly killed this. Confirming: do not build per-directory config overrides. Two tiers (global + project) is enough.

5. **Zod dependency for config validation** -- Do not add Zod. BW's 5-dependency footprint is a competitive advantage (OMC has 12, OMO has 16). Write a 50-line hand-rolled validator that covers the actual config shape. The error messages can be just as good without a schema library.

6. **Integration test suite with fixture sessions (P3.3) as described** -- 200+ recorded session JSONs is maintenance hell. Every gateway change requires updating fixtures. Instead: parameterized tests with inline prompt strings. Same coverage, zero fixture rot. Reframe, do not kill entirely.

---

## Final Roadmap

### Phase 1: v1.1.0 -- "Sharpen the Core" (2 weeks)

The theme: make what BW already claims to do actually work at full quality.

| # | Deliverable | Why | Effort |
|---|-------------|-----|--------|
| 1a | Write dedicated prompts for top 15 agents (sr-backend, sr-frontend, sr-fullstack, architect, devops, security, db-specialist, api-designer, performance, accessibility, tech-lead, pm-lead, critic-lead, ux-researcher, code-reviewer) | BW's #1 differentiator is hollow without them. 15 agents covers the most-used specialists. Each prompt defines expertise, decision style, and interaction protocol. | 15-20h |
| 1b | Gateway test expansion: 100+ classification test cases covering solo/pair/trio/squad/hierarchy boundaries, bilingual prompts, edge cases, and regression cases from recent fixes | Gateway misclassification is the #1 user frustration. Tests prevent regressions. | 10-12h |
| 1c | Deterministic Read-before-Edit guard (shell hook) | Hard safety improvement. Eliminates token waste from LLM-based grounding checks. 3-4h of work, permanent reliability gain. | 3-4h |
| 1d | Vitest coverage configuration (v8 provider, text + lcov reporters, `npm run test:coverage` script) | Makes all future test gaps visible. Trivial setup, permanent benefit. | 2h |
| 1e | Doctor skill enhancement: validate prompt file existence, HUD cache health, webhook config, hooks.json integrity | Prevents "it is not working and I do not know why" frustration. Cheap extension of existing skill. | 4-5h |

**Total: ~35-43 hours. Release criteria: 49 agents with 15+ dedicated prompts, 300+ test assertions, coverage tooling active, grounding guard deterministic.**

---

### Phase 2: v1.2.0 -- "Open the Box" (3 weeks)

The theme: let agents access BW's own data and let users see what agents are doing.

| # | Deliverable | Why | Effort |
|---|-------------|-----|--------|
| 2a | MCP server with 5 tools (bestwork_plan, bestwork_agents, bestwork_meeting_log, bestwork_session_stats, bestwork_heatmap) | Agents currently have no way to query BW's own data programmatically. This is the viable extensibility path via Claude Code's plugin MCP support. | 12-16h |
| 2b | HUD dense statusline: git state, context %, active agent, session duration, loop warning, usage -- all in one line | Power users live in the HUD. One element is embarrassing next to OMC. Six data points in one dense line is the right tradeoff for statusLine constraints. | 8-10h |
| 2c | Skill fuzzy matching + "did you mean?" suggestions | Daily-use quality-of-life. Users stop guessing skill names. Levenshtein in 20 LOC, no dependency. | 4-5h |
| 2d | Simple session summary: write one-paragraph summary to `.bestwork/state/last-session.md` on Stop, inject on SessionStart | Cross-session continuity without complex state machines. Replaces the overengineered P2.4 execution-state proposal. | 2-3h |
| 2e | Config validation: hand-written validator (no Zod) for global + project config with clear error messages | Table stakes. Catches typos in webhook URLs, invalid agent IDs, malformed config. | 4-5h |

**Total: ~30-39 hours. Release criteria: 5 MCP tools registered, HUD shows 6 data points, fuzzy skill matching active, session summary persists across sessions.**

---

### Phase 3: v2.0.0 -- "Agent Intelligence" (4 weeks)

The theme: make the agent system smarter, not bigger. This is where BW pulls ahead instead of playing catch-up.

| # | Deliverable | Why | Effort |
|---|-------------|-----|--------|
| 3a | Complete all 49 agent prompts (remaining 30+ agents) | Full agent catalog with real, distinct expertise. This is the moat. | 20-25h |
| 3b | Agent effectiveness scoring: track which agents produce accepted vs reverted outputs, surface in `/bestwork-agent:agents` and stats card | BW is the only harness that can measure individual agent effectiveness because it is the only one with named agents. This is a unique feature nobody can copy without rebuilding the agent system. | 12-16h |
| 3c | User-extensible skills via `.bestwork/skills/` and `~/.bestwork/skills/` (SKILL.md format) | Users can add project-specific or personal skills without forking. Lightweight extension point that fits the opinionated model. | 6-8h |
| 3d | Meeting log search and review: `/bestwork-agent:meetings` skill to search past meeting decisions by date, agent, topic | BW's meeting metaphor is unique. Make the accumulated meeting history useful -- "what did the team decide about the auth system?" becomes answerable. | 8-10h |
| 3e | Parameterized gateway regression suite: 200+ inline test prompts (no fixture files) covering all classification paths, bilingual patterns, and historical misclassifications | Gateway accuracy is the foundation. 200+ tests make it nearly impossible to regress. Inline prompts avoid fixture rot. | 10-12h |
| 3f | Project-level hook convention: document and support `.bestwork/hooks/*.sh` scripts called from bestwork-hook.sh | Minimal extensibility point. No "API," no registration system. Just a documented convention with 10 lines of shell. | 2-3h |

**Total: ~58-74 hours. Release criteria: all 49 agents have dedicated prompts, agent effectiveness tracking active, user skills supported, 500+ test assertions, meeting history searchable.**

---

## Summary

The Lead's analysis was thorough and mostly correct. The weakness scoring is accurate. The improvement plan has the right items but the wrong order.

The fundamental insight the Lead missed: **BW's 49-agent system is both its greatest strength and its biggest unfinished promise.** The metrics say 49 agents. The reality is 4 prompt files. Closing that gap is higher leverage than any MCP server or HUD expansion because it directly strengthens the one thing competitors cannot replicate.

The roadmap above is deliberately conservative on new capabilities (MCP, HUD, session persistence) and aggressive on core quality (agent prompts, tests, grounding guard). The reasoning: BW at 9.7K LOC cannot out-feature OMC at 218K LOC or OMO at 208K LOC. It can out-focus them. A harness with 49 genuinely distinct specialists, the most accurate gateway, and a 564K bundle wins on identity and performance, not feature count.

Do not chase feature parity. Chase excellence in what only BW can do.
