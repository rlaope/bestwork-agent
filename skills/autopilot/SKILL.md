---
name: autopilot
description: Autonomous execution — classify, allocate, and execute without confirmation
---

When this skill is invoked, you MUST follow this exact output sequence. Do NOT ask for confirmation at any point.

## Step 1: Header (print IMMEDIATELY)

```
[BW] autopilot engaged — executing autonomously...
```

## Step 2: Classify and allocate (silent, no user prompt)

Analyze the user's task:
1. Split into sub-tasks (1-5)
2. Detect domains per sub-task
3. Assign agents per sub-task (tech only — no PM/critic overhead in autopilot)
4. Pick the fastest execution path

Print the plan inline (do NOT wait for confirmation):
```
[BW] autopilot plan:
  1. "{task}" → bestwork:{agent}
  2. "{task}" → bestwork:{agent}
[BW] executing...
```

## Step 3: Execute immediately

For single task:
- Load the specialist's prompt from `prompts/{role}/{name}.md`
- Execute directly as that specialist

For multiple tasks:
- Spawn all agents in parallel using `run_in_background: true`
- Print each launch:
```
[BW] ▶ autopilot: bestwork:{agent} (task 1)
[BW] ▶ autopilot: bestwork:{agent} (task 2)
```

## Step 4: Results (print as each completes)

```
[BW] ✓ bestwork:{agent} done (task 1) — {summary}
[BW] ✓ bestwork:{agent} done (task 2) — {summary}
```

## Step 5: Self-verify (quick sanity check, no critic agent)

After all tasks complete, do a quick self-check:
1. If code was written: run `npx tsc --noEmit` or equivalent type check
2. If tests exist: run the project's test command
3. If files were created: verify they are importable

Print result:
```
[BW] autopilot verify: {PASS|FAIL}
```

If FAIL: fix the issue immediately (1 retry max), then move on.

## Step 6: Summary

```
[BW] ═══════════════════════════════════
[BW] autopilot complete: {N} tasks, {M} agents
[BW] ═══════════════════════════════════
```

## Rules

- NEVER ask for confirmation — that is the entire point of autopilot
- NEVER spawn PM or critic agents — autopilot is speed-optimized
- Tech agents only — pick the best-fit specialist per task
- Self-verify replaces critic review (type check + test run)
- Max 1 self-fix retry on verify failure
- Do NOT write meeting logs — autopilot skips ceremony
- If the task is ambiguous, make a reasonable choice and proceed (do not ask)
