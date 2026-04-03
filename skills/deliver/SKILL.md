---
name: deliver
description: Persistent completion mode — tasks must finish fully with verify/fix loops until done
---

When this skill is invoked, you MUST follow this exact output sequence.

## Step 1: Header (print IMMEDIATELY)

```
[BW] deliver mode — persistent completion, no task left behind...
```

## Step 2: Task registration

Break the user's request into discrete completion targets. Each target has a clear done-condition.

```
[BW] deliver targets:
  [ ] 1. {target} — done when: {concrete condition}
  [ ] 2. {target} — done when: {concrete condition}
  [ ] 3. {target} — done when: {concrete condition}
```

## Step 3: Execute with verify/fix loops

For EACH target, call TaskCreate for live progress:
`TaskCreate: subject="target N: {target}", activeForm="delivering target N..."`
Update with TaskUpdate as targets complete.

Execute in a loop until the done-condition is met:

```
[BW] deliver: working on target 1...
[BW] ▶ bestwork:{agent} implementing target 1
```

After implementation, VERIFY the done-condition:

```
[BW] deliver: verifying target 1...
```

Verification must use concrete checks:
- If code: run type check (`npx tsc --noEmit`), run tests, check imports
- If config: validate JSON/YAML, check references resolve
- If docs: verify links, check accuracy against code
- If refactor: ensure no regressions (tests still pass, no broken imports)

If verification passes:
```
[BW] ✓ target 1 complete (1 attempt)
```

If verification fails:
```
[BW] ✗ target 1 failed verification: {reason}
[BW] ↻ deliver: fixing target 1 (attempt 2)...
```

Fix the specific issue, then re-verify. Repeat until done.

## Step 4: Progress tracker

After each target completes or fails, show progress:
```
[BW] deliver progress:
  [✓] 1. {target}
  [→] 2. {target} (attempt 3)
  [ ] 3. {target}
```

## Step 5: Escalation (after 5 failed attempts on one target)

If a single target fails verification 5 times:
```
[BW] deliver: target 2 stuck after 5 attempts
[BW]   last failure: {description}
[BW]   attempted fixes: {list}
[BW]   options:
    a) skip and continue (mark as incomplete)
    b) simplify the approach
    c) halt deliver mode
```

Wait for user input. This is the ONLY time deliver asks for input.

## Step 6: Completion

```
[BW] ═══════════════════════════════════
[BW] deliver complete: {N}/{M} targets done, {K} total attempts
[BW]   {list completed targets}
[BW] ═══════════════════════════════════
```

After writing the meeting log footer to `.bestwork/state/meeting.jsonl`, also append a decisions entry to `.bestwork/context/decisions.md`. Create the file and directory if they do not exist.

Format:
```markdown
## {date}: {task}
- **Mode**: deliver ({N} targets, {K} attempts)
- **Verdict**: {COMPLETE/INCOMPLETE}
- **Key agents**: {comma-separated agent list}
- **Summary**: {1-sentence summary of what was delivered}
```

## State persistence

Save deliver state to `.bestwork/state/deliver.json`:
```json
{
  "created": "<ISO timestamp>",
  "task": "<user's original request>",
  "targets": [
    { "description": "...", "doneCondition": "...", "status": "complete", "attempts": 1 },
    { "description": "...", "doneCondition": "...", "status": "in_progress", "attempts": 3 }
  ]
}
```

Resume with `./deliver` — picks up incomplete targets.

## Rules

- NEVER mark a target as done without concrete verification
- Verification must run actual commands (not just visual inspection)
- No max retry limit per target (except the 5-attempt escalation prompt)
- Targets are executed sequentially (later targets may depend on earlier ones)
- Each verify/fix cycle should attempt a DIFFERENT fix strategy (not the same thing repeatedly)
- Agent selection: pick the best-fit tech specialist per target, switch agents on escalation
- Write meeting log to `.bestwork/state/meeting.jsonl` with attempt tracking
- deliver does NOT use PM or critic agents — the verify loop replaces them
