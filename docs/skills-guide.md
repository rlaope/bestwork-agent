# bestwork-agent Skills Guide

Visual guide to how each skill works.

## Architecture Overview

```
User Prompt
    │
    ▼
┌──────────────────────────────────┐
│  Smart Gateway (UserPromptSubmit) │
│                                   │
│  [BW] analyzing request...        │
│  [BW] I see 2 tasks: X and Y     │
│  [BW] this is a TRIO job          │
│                                   │
│  Classify → Announce → Execute    │
└──────────┬───────────────────────┘
           │
     ┌─────┼─────┬─────────┐
     ▼     ▼     ▼         ▼
  SOLO   PAIR  TRIO    SQUAD/HIERARCHY
   │      │     │         │
   │      │     │    ┌────┼────┐
   ▼      ▼     ▼    ▼    ▼    ▼
  Main   2      Tech  All agents
  Agent  Agents  PM   in parallel
                Critic  or chain
```

---

## /bestwork-agent:trio

Parallel execution with quality gates per task.

```
./trio implement auth | add tests | update docs
         │                │              │
         ▼                ▼              ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │ Tech    │    │ Tech    │    │ Tech    │
    │ auth    │    │ testing │    │ writer  │
    │ agent   │    │ agent   │    │ agent   │
    └────┬────┘    └────┬────┘    └────┬────┘
         │              │              │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ PM      │    │ PM      │    │ PM      │
    │ verify  │    │ verify  │    │ verify  │
    │ reqs    │    │ reqs    │    │ reqs    │
    └────┬────┘    └────┬────┘    └────┬────┘
         │              │              │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Critic  │    │ Critic  │    │ Critic  │
    │ quality │    │ quality │    │ quality │
    │ + hallu │    │ + hallu │    │ + hallu │
    └────┬────┘    └────┬────┘    └────┬────┘
         │              │              │
    APPROVE?       APPROVE?       APPROVE?
    yes → done     no → retry     yes → done
                   (max 3x)
```

---

## /bestwork-agent:review

Hallucination and platform mismatch scanner.

```
./review
    │
    ▼
┌─────────────────────────────────┐
│  1. Fake imports                │  import { foo } from "nonexistent"
│  2. Missing file refs           │  from "./missing-file.js"
│  3. Platform mismatch           │  /proc/ on macOS
│  4. Wrong runtime               │  Deno.* without Deno
│  5. Deprecated patterns         │  new Buffer()
│  6. Hallucinated methods        │  console.success()
│  7. Type safety bypasses        │  as any, @ts-ignore
└────────────────┬────────────────┘
                 │
         ┌───────┴───────┐
         ▼               ▼
   ✅ All clear    ⚠️ N issues found
                   (listed with details)
```

---

## /bestwork-agent:health

Quick session diagnostic.

```
./health
    │
    ├─→ Outcome: productive / normal / struggling
    │     └─ based on calls/prompt ratio
    │
    ├─→ Loop detection: repeated tool+file patterns
    │     └─ Edit→Bash(fail)→Edit×6 = loop
    │
    ├─→ Platform review: OS/runtime mismatches
    │     └─ scans latest diff
    │
    └─→ Verdict
          ├─ [BW] all green ✅
          └─ [BW] N issues found ⚠️
```

---

## /bestwork-agent:sessions

Session analytics dashboard.

```
bestwork sessions

  Sessions (12 total, 2,450 calls)

  b322dc3e ● 235  16.7%  12h ago    Desktop/khope    💬 add dark mode
  82ab7282 ● 244  17.4%  1d ago     khope/serverdistr 💬 fix auth bug
  f64adc23 ○  21   1.5%  1d ago                      💬 update docs
  ...

  ID  Status  Calls  %     Time       Project      Last Prompt
```

---

## /bestwork-agent:update

Version check and upgrade flow.

```
./update
    │
    ▼
[BW] checking for updates...
    │
    ├─→ installed: 1.0.0
    ├─→ latest:    1.0.1
    │
    ├─ same → [BW] you're on the latest (v1.0.0)
    │
    └─ newer → [BW] update available: 1.0.0 → 1.0.1
               [BW] upgrading... hang tight
               npm install -g bestwork-agent@latest
               [BW] done! restart to apply
```

---

## /bestwork-agent:install

Hook registration into Claude Code.

```
bestwork install
    │
    ▼
┌──────────────────────────────────┐
│  Registers into settings.json:   │
│                                   │
│  PostToolUse                      │
│  ├─ event capture (JSONL)         │
│  └─ validation agent (typecheck)  │
│                                   │
│  PreToolUse                       │
│  ├─ grounding agent (read first)  │
│  ├─ scope enforcement             │
│  └─ strict enforcement            │
│                                   │
│  UserPromptSubmit                 │
│  ├─ slash command handler         │
│  └─ smart gateway agent           │
│                                   │
│  Stop                             │
│  ├─ Discord/Slack notification    │
│  └─ platform review agent         │
│                                   │
│  SessionStart                     │
│  └─ update check                  │
└──────────────────────────────────┘
```

---

## /bestwork-agent:agents

49 specialist agent catalog.

```
bestwork agents

  TECH (25)          PM (10)           CRITIC (14)
  ─────────          ──────            ───────────
  backend            product           performance
  frontend           API               scalability
  fullstack          platform          security
  infra              data              consistency
  database           infra             reliability
  API                migration         testing
  mobile             security          hallucination
  testing            growth            DX
  security           compliance        type safety
  performance        DX                cost
  devops                               accessibility
  data                                 devsecops
  ML                                   i18n
  CLI                                  agent
  realtime
  auth
  migration
  config
  agent-engineer
  plugin
  accessibility
  i18n
  graphql
  monorepo
  writer
```

---

## /bestwork-agent:status

Configuration snapshot.

```
./status
    │
    ▼
[BW] checking status...

  Scope lock:    none (unrestricted)
  Strict mode:   OFF
  Discord:       configured ✅
  Slack:         not set
  Hooks:         11 registered
  CLI version:   1.0.0

[BW] status complete. bestwork v1.0.0 operational.
```

---

## /bestwork-agent:docs

Generate or update project documentation from code.

```
./docs
    │
    ▼
┌─────────────────────────────────┐
│  1. Scan project structure      │
│  2. Identify public APIs        │
│  3. Generate/update docs        │
│  4. Cross-reference with code   │
└────────────────┬────────────────┘
                 │
         ┌───────┴───────┐
         ▼               ▼
   📄 Docs created   📄 Docs updated
      (new project)     (existing docs)
```

---

## /bestwork-agent:plan

Analyze task scope and recommend team composition before executing.

```
./plan refactor auth module
    │
    ▼
┌─────────────────────────────────┐
│  1. Analyze task complexity     │
│  2. Identify affected domains   │
│  3. Recommend team mode         │
│  4. Save plan to .bestwork/     │
└────────────────┬────────────────┘
                 │
                 ▼
  Plan: hierarchy — Security Team
  Agents: tech-auth, tech-security, pm-security
  Estimated complexity: high
  Saved to: .bestwork/plans/<id>.json
```

---

## /bestwork-agent:onboard

First-time user guide.

```
./onboard
    │
    ▼
[BW] welcome to bestwork-agent!

  1. What it does → specialist teams for your AI agent
  2. Quick setup  → bestwork install
  3. Key commands → /trio, /review, /agents, /health
  4. Notifications → ./discord <url> or ./slack <url>
  5. Team modes   → hierarchy vs squad vs trio

[BW] try /bestwork-agent:trio first.
```

---

## /bestwork-agent:doctor

Diagnose project deploy config vs actual code.

```
./doctor
    |
    v
[BW] running project diagnostics...
    |
    +-> package.json scripts vs actual files
    +-> tsconfig paths vs directory structure
    +-> imports vs installed dependencies
    +-> environment variables vs .env templates
    +-> CI/CD config vs project reality
    |
    v
  Report: N mismatches found
  (with fix suggestions per issue)
```

---

## /bestwork-agent:changelog

Auto-generate changelog from git history.

```
./changelog
    |
    v
[BW] generating changelog...
    |
    +-> Read git log since last tag/release
    +-> Categorize commits (feat, fix, refactor, docs, etc.)
    +-> Group by category
    +-> Generate markdown changelog
    |
    v
  CHANGELOG.md updated (or created)
```

---

## /bestwork-agent:blitz

Maximum parallelism burst -- all tasks execute simultaneously with no coordination.

```
./blitz fix all lint errors across src/
    |
    v
[BW] blitz -- maximum parallelism, zero overhead...
[BW] blitz: 6 parallel tasks identified
  1. "fix lint in auth/"      -> bestwork:tech-auth
  2. "fix lint in api/"       -> bestwork:tech-api
  3. "fix lint in db/"        -> bestwork:tech-database
  4. "fix lint in cli/"       -> bestwork:tech-cli
  5. "fix lint in hooks/"     -> bestwork:tech-config
  6. "fix lint in observe/"   -> bestwork:tech-performance
[BW] launching all...
    |
    v (all parallel, 1 agent per task, no PM/critic)
    |
[BW] blitz complete: 6 tasks, 6 agents, 0 conflicts
```

vs trio: blitz skips PM/critic gates. Use for independent batch changes.

---

## /bestwork-agent:delegate

Autonomous execution -- classify, allocate, and execute without confirmation.

```
./delegate refactor the config loader
    |
    v
[BW] delegate engaged -- executing autonomously...
[BW] delegate plan:
  1. "refactor config loader" -> bestwork:tech-config
[BW] executing...
    |
    v (no confirmation, no PM/critic, self-verify only)
    |
[BW] delegate verify: PASS
[BW] delegate complete: 1 task, 1 agent
```

vs trio: delegate never asks for confirmation. Tech agents only + self-verify.

---

## /bestwork-agent:deliver

Persistent completion -- tasks must finish fully with verify/fix loops.

```
./deliver migrate all API routes to v2
    |
    v
[BW] deliver mode -- persistent completion, no task left behind...
[BW] deliver targets:
  [ ] 1. Migrate /users routes    -- done when: tests pass
  [ ] 2. Migrate /auth routes     -- done when: tests pass
  [ ] 3. Update client references -- done when: no v1 imports
    |
    v (execute each, verify, retry until done)
    |
[BW] deliver progress:
  [+] 1. Migrate /users routes
  [->] 2. Migrate /auth routes (attempt 2)
  [ ] 3. Update client references
    |
    v (stuck after 5 attempts? ask user)
    |
[BW] deliver complete: 3/3 targets done, 5 total attempts
```

vs trio: deliver retries until done. No target left incomplete.

---

## /bestwork-agent:waterfall

Sequential staged processing -- each stage must pass before the next begins.

```
./waterfall implement new payment module
    |
    v
[BW] waterfall mode -- sequential stages with gates...
[BW] waterfall stages:
  1. analyze    -> gate: scope documented
  2. implement  -> gate: all files written
  3. verify     -> gate: type check + tests pass
  4. integrate  -> gate: no broken imports
  5. finalize   -> gate: formatted, no warnings
    |
    v (sequential, gate must pass to proceed)
    |
[BW] +-- stage 1: analyze -- PASS
[BW] +-- stage 2: implement -- FAIL (attempt 1/3)
[BW]     retrying stage 2...
[BW] +-- stage 2: implement -- PASS
[BW] +-- stage 3: verify -- PASS
[BW] +-- stage 4: integrate -- PASS
[BW] +-- stage 5: finalize -- PASS
    |
[BW] waterfall complete: 5 stages, all gates passed
```

Custom orders: `./waterfall test-first`, `./waterfall security`, `./waterfall docs`.

---

## StatusLine (HUD)

Real-time status bar at bottom of Claude Code.

```
[BW#1.0.0] | session:20m | 1478calls | 🔧9 📨
  │            │              │          │   │
  version      uptime         tool       hooks notify
                              calls      count status
```

---

## /bestwork-agent:validate

Feature validation gate — evidence-based go/no-go before building.

```
./validate add AI-powered search to the app
    |
    v
[BW] validate — is this really worth building?

[BW] hypothesis:
  Feature:  AI-powered search
  Assumed problem: users can't find what they need
  Assumed user: end users of the app
    |
    v (3 parallel research agents)
    |
    +-> Pain search: real user complaints from Reddit, HN, GitHub
    +-> Alternative scan: existing solutions and their gaps
    +-> Anti-evidence: reasons this might NOT be needed
    |
    v
[BW] evidence report
  Real pain: 12 signals found (strong)
  Alternatives: 3 exist, all lack X
  Anti-evidence: 2 counter-arguments
    |
    v
[BW] validate — purpose check
  1. PHILOSOPHY: Why does this deserve to exist?
  2. EXPERIENCE: What relief/delight does the user feel?
  3. MEASURE: How will you know this succeeded?
    |
    v
[BW] validation scorecard:
  Pain evidence:  75%
  Gap:            80%
  Purpose:        70%
  Anti-evidence:  60%
  Feasibility:    90%
  Overall:        75% → CONDITIONAL
    |
    v
[BW] next:
  a) build — proceed with narrowed scope
  b) research more — dig deeper
  c) pivot — reframe the problem
  d) drop — not worth building
```

Verdicts: VALIDATED (80%+), CONDITIONAL (60-79%), WEAK (40-59%), REJECTED (<40%).

---

## /bestwork-agent:clarify

Ask targeted clarifying questions before execution.

```
./clarify implement user auth
    |
    v
[BW] clarity assessment:
  Goal:     60% — auth type unclear
  Scope:    40% — which endpoints?
  Criteria: 50% — no acceptance criteria
  Risk:     30% — security implications unknown
  Overall:  48%
    |
    v (question loop, max 5 rounds)
    |
[BW] clarify round 1/5 — targeting: Risk (30%)
  "Should auth support OAuth2, JWT, or session-based?
   The codebase currently has no auth middleware."
    |
    v (user answers, scores update)
    |
[BW] clarify complete — 3 rounds, 82% clarity
  Requirements: [confirmed list]
  Decisions: [from Q&A]
  Recommended: trio with tech-auth + pm-security
```

---

## /bestwork-agent:superthinking

1000-iteration thought simulation loop.

```
./superthinking design the plugin architecture
    |
    v
[BW] superthinking — 1000 iterations of plan/build/validate/critique...
    |
    v (deep reasoning cycles)
    |
[BW] superthinking complete
  Key insights: [...]
  Recommended approach: [...]
```

---

## /bestwork-agent:pipeline-run

Queue and auto-process multiple GitHub issues.

```
./pipeline-run #12 #15 #18
    |
    v
[BW] pipeline: 3 issues queued
  #12 → branch: fix/issue-12 → team assigned → PR created
  #15 → branch: feat/issue-15 → team assigned → PR created
  #18 → branch: fix/issue-18 → team assigned → PR created
[BW] pipeline complete: 3/3 merged
```

---

## Smart Gateway Decision Flow

```
User types anything
         │
         ▼
  ┌──────────────┐
  │ Is it a ./   │──yes──→ Execute bestwork command
  │ command?     │
  └──────┬───────┘
         │ no
         ▼
  ┌──────────────┐
  │ Skill route? │──yes──→ Invoke matching skill
  │ (regex match)│         (review, trio, plan, etc.)
  └──────┬───────┘
         │ no
         ▼
  ┌──────────────┐
  │ Passthrough? │──yes──→ Do nothing (git, ls, yes/no)
  └──────┬───────┘
         │ no
         ▼
  ┌──────────────┐
  │classifyIntent│
  │ - split tasks│
  │ - domains    │
  │ - complexity │
  └──────┬───────┘
         │
    ┌────┴────────┐
    ▼             ▼
  SOLO        NON-SOLO
   │          (pair/trio/squad/hierarchy)
   ▼             │
  [BW] solo      ▼
  proceed     Show plan (tasks + agents)
              Ask user:
                1. Confirm plan
                2. Adjust
                3. Solo instead
```
