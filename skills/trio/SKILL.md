---
name: trio
description: Execute tasks in parallel with dynamically assigned agents per task
---

When this skill is invoked, you MUST follow this exact output sequence. Do NOT skip any print statement.

## Step 1: Header (print IMMEDIATELY)

```
[BW] assembling team...
```

## Step 2: Task breakdown (print BEFORE any agent spawns)

For EACH task, print on its own line:
```
[BW] task 1: "{task}" → [agent1, agent2]
[BW] task 2: "{task}" → [agent1]
[BW] task 3: "{task}" → [agent1, agent2, agent3]
```

## Step 3: Launch (print EACH agent as you spawn it)

When spawning agents, print a `[BW]` line for EVERY SINGLE agent spawn. This is critical — users need to see agents launching in rapid succession:

```
[BW] ▶ launching bestwork:tech-auth (task 1)
[BW] ▶ launching bestwork:critic-security (task 1)
[BW] ▶ launching bestwork:tech-testing (task 2)
[BW] ▶ launching bestwork:tech-frontend (task 3)
[BW] ▶ launching bestwork:pm-product (task 3)
[BW] ▶ launching bestwork:critic-dx (task 3)
```

Print each `[BW] ▶ launching` line IMMEDIATELY before each Agent tool call. Do NOT batch them — print one, spawn one, print next, spawn next. This creates the "rapid fire" visual effect.

IMPORTANT: For EACH agent you spawn, ALSO call TaskCreate so the user sees a live progress spinner:
```
TaskCreate: subject="bestwork:tech-auth (task 1)", description="implementing auth endpoint", activeForm="bestwork:tech-auth working..."
TaskCreate: subject="bestwork:critic-security (task 1)", description="reviewing security", activeForm="bestwork:critic-security reviewing..."
TaskCreate: subject="bestwork:tech-testing (task 2)", description="writing tests", activeForm="bestwork:tech-testing writing..."
```

This shows live spinners under the prompt for each running agent. When an agent completes, update the task with TaskUpdate (status: completed).

## Step 4: Results (print as each agent completes)

As each background agent completes:
1. Call TaskUpdate to mark the task as completed
2. Print the result line:
```
[BW] ✓ bestwork:tech-auth done (task 1) — implemented auth endpoint
[BW] ✓ bestwork:critic-security done (task 1) — APPROVE, no issues
[BW] ✗ bestwork:pm-product rejected (task 3) — missing error handling
```

## Step 5: Feedback loop (if rejected)

```
[BW] ↻ task 3: feeding critic feedback to tech (round 2/3)
[BW] ▶ re-launching bestwork:tech-frontend (task 3, round 2)
```

## Step 6: Summary (print at end)

```
[BW] ═══════════════════════════════════
[BW] complete: {N} tasks, {M} agents, {K} rounds
[BW] ═══════════════════════════════════
```

## Step 7: Summary Report

After printing the summary line, call `report-writer` (`src/observe/report-writer.ts`) to save detailed output:

```
writeReport("trio", {
  total: {N},
  done: {M},
  agents: [list of all agents used],
  tasks: [list of task descriptions],
  durationMs: {elapsed ms},
  decisions: [key decisions from meeting log]
}, projectRoot)
```

Then call `summarize` (`src/observe/result-summarizer.ts`) and print the 1-liner:
```
[BW] ✓ {M}/{N} done — details: .bestwork/reports/trio-{timestamp}.md
```

After writing the meeting log footer to `.bestwork/state/meeting.jsonl`, also append a decisions entry to `.bestwork/context/decisions.md`. Create the file and directory if they do not exist.

Format:
```markdown
## {date}: {task}
- **Mode**: trio ({N} agents)
- **Verdict**: {APPROVED/REJECTED}
- **Key agents**: {comma-separated agent list}
- **Summary**: {1-sentence summary from the meeting}
```

## Agent allocation rules

The gateway provides `taskAllocations` with agents per task. If not provided, allocate:
- 1 agent: simple single-file change
- 2 agents (tech + critic): standard work needing review
- 3 agents (tech + pm + critic): feature with requirements
- 4 agents (tech + pm + critic + lead): architecture-critical

## Rules

- EVERY agent spawn gets its own `[BW] ▶` line
- EVERY agent completion gets its own `[BW] ✓` or `[BW] ✗` line
- Use `run_in_background: true` for parallel agents
- Write meeting log to `.bestwork/state/meeting.jsonl`
- Max 3 feedback rounds per task
