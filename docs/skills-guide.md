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
               /plugin update bestwork-agent@bestwork-tools
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

## StatusLine (HUD)

Real-time status bar at bottom of Claude Code.

```
[BW#1.0.0] | session:20m | 1478calls | 🔧9 📨
  │            │              │          │   │
  version      uptime         tool       hooks notify
                              calls      count status
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
