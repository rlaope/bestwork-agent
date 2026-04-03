---
name: blitz
description: Maximum parallelism burst — all tasks execute simultaneously with no coordination overhead
---

When this skill is invoked, you MUST follow this exact output sequence.

## Step 1: Header (print IMMEDIATELY)

```
[BW] blitz — maximum parallelism, zero overhead...
```

## Step 2: Task decomposition (aggressive splitting)

Split the user's request into the MAXIMUM number of independent sub-tasks. Blitz splits more aggressively than trio:
- Trio: 1-5 tasks with agents per task
- Blitz: up to 10 tasks, 1 agent per task, all parallel

```
[BW] blitz: {N} parallel tasks identified
  1. "{task}" → bestwork:{agent}
  2. "{task}" → bestwork:{agent}
  ...
  N. "{task}" → bestwork:{agent}
[BW] launching all...
```

## Step 3: Launch ALL agents simultaneously

Print each launch line, then spawn immediately. Do NOT wait between spawns:

```
[BW] ▶ blitz: bestwork:{agent1} (task 1)
[BW] ▶ blitz: bestwork:{agent2} (task 2)
[BW] ▶ blitz: bestwork:{agent3} (task 3)
[BW] ▶ blitz: bestwork:{agent4} (task 4)
[BW] ▶ blitz: bestwork:{agent5} (task 5)
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
[BW] blitz: conflict detected in {file}
[BW]   task 2 wrote lines 10-20
[BW]   task 4 wrote lines 15-25
[BW]   resolving: merging changes (task 2 priority — completed first)
```

## Step 6: Quick verify

Run a single verification pass over all changes:
```
[BW] blitz verify: type check... {PASS|FAIL}
[BW] blitz verify: tests... {PASS|FAIL}
```

If any verify fails, fix inline (no retry loop — blitz is about speed).

## Step 7: Summary

```
[BW] ═══════════════════════════════════
[BW] blitz complete: {N} tasks, {M} parallel agents, {K} conflicts resolved
[BW] ═══════════════════════════════════
```

## When to use blitz vs trio

- **Blitz**: many independent changes (batch fixes, multi-file refactors, style updates, lint fixes, test additions). No coordination needed.
- **Trio**: tasks that need quality gates (PM review, critic feedback). Coordination matters.

## Rules

- ONE agent per task — no PM, no critic, no lead
- ALL agents launch simultaneously — maximum parallelism
- NO meeting logs — blitz skips all ceremony
- NO feedback loops — if something fails, fix it once and move on
- NO confirmation prompt — blitz is fire-and-forget (like autopilot)
- Conflicts resolved by completion order (first to finish wins, later merges)
- Agent selection: tech specialists only, best-fit per task domain
- Up to 10 parallel tasks (Claude Code agent limit)
