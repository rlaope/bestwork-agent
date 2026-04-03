---
name: ultrawork
description: Maximum parallelism burst — all tasks execute simultaneously with no coordination overhead
---

When this skill is invoked, you MUST follow this exact output sequence.

## Step 1: Header (print IMMEDIATELY)

```
[BW] ultrawork — maximum parallelism, zero overhead...
```

## Step 2: Task decomposition (aggressive splitting)

Split the user's request into the MAXIMUM number of independent sub-tasks. Ultrawork splits more aggressively than trio:
- Trio: 1-5 tasks with agents per task
- Ultrawork: up to 10 tasks, 1 agent per task, all parallel

```
[BW] ultrawork: {N} parallel tasks identified
  1. "{task}" → bestwork:{agent}
  2. "{task}" → bestwork:{agent}
  ...
  N. "{task}" → bestwork:{agent}
[BW] launching all...
```

## Step 3: Launch ALL agents simultaneously

Print each launch line, then spawn immediately. Do NOT wait between spawns:

```
[BW] ▶ ultrawork: bestwork:{agent1} (task 1)
[BW] ▶ ultrawork: bestwork:{agent2} (task 2)
[BW] ▶ ultrawork: bestwork:{agent3} (task 3)
[BW] ▶ ultrawork: bestwork:{agent4} (task 4)
[BW] ▶ ultrawork: bestwork:{agent5} (task 5)
```

ALL agents use `run_in_background: true`. Every agent runs independently with no cross-communication.

## Step 4: Results (print as each completes, in completion order)

```
[BW] ✓ task 3 done — bestwork:{agent3} — {summary}
[BW] ✓ task 1 done — bestwork:{agent1} — {summary}
[BW] ✓ task 5 done — bestwork:{agent5} — {summary}
[BW] ✓ task 2 done — bestwork:{agent2} — {summary}
[BW] ✗ task 4 failed — bestwork:{agent4} — {error}
```

## Step 5: Conflict resolution (if needed)

If multiple agents edited the same file, detect and resolve:
```
[BW] ultrawork: conflict detected in {file}
[BW]   task 2 wrote lines 10-20
[BW]   task 4 wrote lines 15-25
[BW]   resolving: merging changes (task 2 priority — completed first)
```

## Step 6: Quick verify

Run a single verification pass over all changes:
```
[BW] ultrawork verify: type check... {PASS|FAIL}
[BW] ultrawork verify: tests... {PASS|FAIL}
```

If any verify fails, fix inline (no retry loop — ultrawork is about speed).

## Step 7: Summary

```
[BW] ═══════════════════════════════════
[BW] ultrawork complete: {N} tasks, {M} parallel agents, {K} conflicts resolved
[BW] ═══════════════════════════════════
```

## When to use ultrawork vs trio

- **Ultrawork**: many independent changes (batch fixes, multi-file refactors, style updates, lint fixes, test additions). No coordination needed.
- **Trio**: tasks that need quality gates (PM review, critic feedback). Coordination matters.

## Rules

- ONE agent per task — no PM, no critic, no lead
- ALL agents launch simultaneously — maximum parallelism
- NO meeting logs — ultrawork skips all ceremony
- NO feedback loops — if something fails, fix it once and move on
- NO confirmation prompt — ultrawork is fire-and-forget (like autopilot)
- Conflicts resolved by completion order (first to finish wins, later merges)
- Agent selection: tech specialists only, best-fit per task domain
- Up to 10 parallel tasks (Claude Code agent limit)
