---
name: waterfall
description: Sequential staged processing — each stage must pass before the next begins
---

When this skill is invoked, you MUST follow this exact output sequence.

## Step 1: Header (print IMMEDIATELY)

```
[BW] waterfall mode — sequential stages with gates...
```

## Step 2: Define stages

Analyze the user's task and break it into sequential stages. Each stage has a gate condition that MUST pass before proceeding.

Default waterfall (adapt based on task):
1. **analyze** — understand requirements, identify affected files, map dependencies
2. **implement** — write the code changes
3. **verify** — run type checks, linters, tests
4. **integrate** — ensure changes work with existing code (import checks, no regressions)
5. **finalize** — clean up, format, commit-ready state

Print the waterfall:
```
[BW] waterfall stages:
  1. analyze    → gate: scope documented
  2. implement  → gate: all files written
  3. verify     → gate: type check + tests pass
  4. integrate  → gate: no broken imports
  5. finalize   → gate: formatted, no warnings
```

## Step 3: Execute each stage sequentially

For EACH stage, print entry and exit:

```
[BW] ┌─ stage 1: analyze
```

Execute the stage work. Assign the best-fit agent per stage:
- analyze: pm-product or tech-fullstack
- implement: tech-{domain} specialist
- verify: tech-testing or critic-code
- integrate: tech-fullstack
- finalize: tech-config or tech-writer

When stage completes, evaluate the gate:

```
[BW] └─ stage 1: analyze — PASS (3 files, 2 domains identified)
```

or if gate fails:

```
[BW] └─ stage 2: implement — FAIL (missing error handler in auth.ts)
[BW] ↻ retrying stage 2 (attempt 2/3)
[BW] ┌─ stage 2: implement (retry)
```

## Step 4: Gate failure handling

- Each stage gets max 3 attempts
- If a stage fails 3 times, the waterfall halts:
```
[BW] ✗ waterfall halted at stage 2: implement
[BW]   reason: {failure description}
[BW]   completed: stages 1/5
[BW]   run ./waterfall to resume from stage 2
```

## Step 5: Waterfall complete

```
[BW] ═══════════════════════════════════
[BW] waterfall complete: {N} stages, all gates passed
[BW] ═══════════════════════════════════
```

## Custom waterfalls

Users can define custom stage orders:
- `./waterfall test-first` — verify → implement → verify → finalize (TDD)
- `./waterfall security` — analyze → implement → security-audit → verify → finalize
- `./waterfall docs` — analyze → implement → document → verify → finalize

## State persistence

Save waterfall state to `.bestwork/state/waterfall.json`:
```json
{
  "created": "<ISO timestamp>",
  "task": "<user's original request>",
  "stages": [
    { "name": "analyze", "status": "complete", "attempts": 1 },
    { "name": "implement", "status": "running", "attempts": 1 }
  ],
  "currentStage": 1
}
```

This enables resuming a halted waterfall with `./waterfall` (picks up from last incomplete stage).

## Rules

- Stages are STRICTLY sequential — never parallelize across stages
- Each gate must be evaluated with concrete evidence (not just "looks good")
- Gate checks should run actual commands when possible (tsc, test runner, linter)
- Max 3 retries per stage before halt
- Save state after each stage completion for resume capability
- Write meeting log to `.bestwork/state/meeting.jsonl` with stage transitions
