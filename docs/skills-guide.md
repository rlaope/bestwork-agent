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
    ├─→ installed: 0.9.0
    ├─→ latest:    0.9.1
    │
    ├─ same → [BW] you're on the latest (v0.9.0)
    │
    └─ newer → [BW] update available: 0.9.0 → 0.9.1
               [BW] upgrading... hang tight
               /plugin update bestwork-agent
               /reload-plugins
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

46 specialist agent catalog.

```
bestwork agents

  TECH (19)          PM (8)            CRITIC (11)
  ─────────          ──────            ───────────
  backend            product           performance
  frontend           API               scalability
  fullstack          platform          security
  infra              data              consistency
  database           infra             reliability
  API                migration         testing
  mobile             security          hallucination
  testing            growth            DX
  security                             type safety
  performance                          cost
  devops                               devsecops
  data
  ML
  CLI
  realtime
  auth
  migration
  config
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
  CLI version:   0.9.0

[BW] status complete. bestwork v0.9.0 operational.
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

## StatusLine (HUD)

Real-time status bar at bottom of Claude Code.

```
[BW#0.9.0] | session:20m | 1478calls | 🔧9 📨
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
  │ Is it pass-  │──yes──→ Do nothing (git, ls, yes/no)
  │ through?     │
  └──────┬───────┘
         │ no
         ▼
  ┌──────────────┐
  │ Analyze:     │
  │ - task count │
  │ - domains    │
  │ - complexity │
  └──────┬───────┘
         │
    ┌────┼────┬────────┐
    ▼    ▼    ▼        ▼
  SOLO PAIR  TRIO   AMBIGUOUS
   │    │     │        │
   │    │     │    ┌───▼────┐
   ▼    ▼     ▼    │ Ask    │
  Main  2    3×3   │ user:  │
  agent devs Tech  │ 1.trio │
              PM   │ 2.squad│
             Crit  │ 3.hier │
                   │ 4.solo │
                   └────────┘
```
