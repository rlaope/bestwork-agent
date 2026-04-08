---
name: pipeline-run
description: Queue and auto-process multiple GitHub issues — each gets its own branch, team, PR, and merge
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] pipeline starting...
```

## Flags

- `./pipeline-run #16 #17 #18` — explicit issue numbers
- `./pipeline-run --resume` — resume from last saved state (skip completed issues)
- `./pipeline-run --dry-run #16 #17 #18` — preview queue and schedule without executing
- `./pipeline-run --sequential` — force all issues sequential (no parallel solos)

## Step 1: Resolve issues

Check for `--resume` first:

### Resume mode
```bash
# Read saved state
cat .bestwork/state/pipeline-run.json
```
Filter to issues with `status != "merged"`. Print:
```
[BW] resuming pipeline — {N} of {M} issues remaining
[BW]   skipping: #16 (merged), #18 (merged)
[BW]   resuming: #17 (in_progress, attempt 2), #19 (pending)
```

### Normal mode
The user can provide:
- Explicit issue numbers: `./pipeline-run #16 #17 #18`
- Natural language: "떠있는 이슈 다 처리해", "process all open issues", "remaining v2.0 issues"

If explicit numbers given:
```bash
# For each number, read the issue
gh issue view {N} --json title,body,labels --jq '{number: {N}, title: .title, body: .body}'
```

If natural language (no numbers):
```bash
# List all open issues
gh issue list --state open --limit 30 --json number,title,labels
```
Then filter based on user intent:
- "v2.0 issues" → filter by label `v2.0` or title containing "v2.0"
- "critical bugs" → filter by label `bug` + `critical`
- "my issues" → `gh issue list --assignee @me`
- Fallback: show all open issues and let the user confirm

Print the queue:
```
[BW] pipeline queue:
  1. #16 — complete all 49 agent prompts (large)
  2. #17 — agent effectiveness scoring (medium)
  3. #18 — user-extensible skills (medium)
  
  3 issues queued. processing...
```

## Step 2: Classify each issue

For each issue, read its title and body. Determine:
- **Scale**: solo (small fix) / trio (feature with quality gate) / blitz (bulk parallel work)
- **Agents**: which bestwork specialist agents to assign based on the issue domain
- **Dependencies**: detect from GitHub issue body ("depends on #N", "blocked by #N"), linked issues, or shared file paths

Print classification:
```
[BW] #16 → blitz (34 prompt files, tech-writer)
[BW] #17 → trio (agent-engineer + pm-dx + critic-agent)
[BW] #18 → solo (tech-plugin)
[BW] deps: #17 blocked by #16 (shared prompt format)
```

## Step 2.5: Scheduling — parallel vs sequential

**Scheduling rules** (CRITICAL — prevents context explosion):
1. **solo issues** (1 agent): CAN run in parallel with other solos
2. **trio/squad issues** (3+ agents): run ONE AT A TIME, sequentially
3. **blitz issues** (many parallel agents): run ONE AT A TIME, sequentially
4. Priority: finish ALL solo issues first (fast, clears the queue), THEN process heavy issues one by one
5. Dependency order: if #17 depends on #16, #16 runs first regardless of scale

If `--sequential` flag: force all issues sequential.

Example with 4 issues:
```
[BW] schedule:
  parallel: #18 (solo) + #20 (solo)     ← fast, run together
  then:     #16 (blitz, 34 files)       ← heavy, run alone
  then:     #17 (trio, blocked by #16)  ← heavy + dependency
```

NEVER spawn more than 5 agents at once. If a trio (3 agents) is running, do NOT start another trio in parallel.

### Dry-run mode

If `--dry-run`, print the schedule and STOP. Do not execute:
```
[BW] dry-run complete — {N} issues classified, schedule above
[BW] run without --dry-run to execute
```

## Step 3: Initialize state + progress tracking

### Save initial state
Write `.bestwork/state/pipeline-run.json`:
```json
{
  "created": "<ISO timestamp>",
  "userRequest": "<original prompt>",
  "flags": { "resume": false, "dryRun": false, "sequential": false },
  "issues": [
    {
      "number": 16,
      "title": "complete all 49 agent prompts",
      "scale": "blitz",
      "agents": ["tech-writer"],
      "status": "pending",
      "attempts": 0,
      "branch": null,
      "pr": null,
      "merged": false,
      "blockedBy": [],
      "error": null
    }
  ],
  "schedule": {
    "parallel": [18, 20],
    "sequential": [16, 17]
  },
  "startedAt": "<ISO timestamp>",
  "completedAt": null
}
```

### Create tasks for live progress
For EACH issue, call TaskCreate:
```
TaskCreate: subject="pipeline #N: {title}", activeForm="pipeline: processing #N..."
```

### Write meeting log header
Append to `.bestwork/state/meeting.jsonl`:
```json
{"type":"header","teamName":"pipeline-run","task":"Queue: #16, #17, #18","classification":"PIPELINE","issueCount":3,"timestamp":"<ISO>"}
```

## Step 4: Process each issue

Process according to the schedule from Step 2.5:

### 4a. Branch
```bash
git checkout main && git pull && git checkout -b feat/issue-{N}
```

Update state: `status: "branched"`

### 4b. Execute
Based on the classification:
- **solo**: single agent implements directly
- **trio**: Tech implements → PM verifies → Critic reviews (max 3 rounds)
- **blitz**: spawn all agents in parallel

### 4c. Gate verification (scale-specific)

Each scale has concrete gate conditions — NOT just "tests pass":

**Solo gates:**
1. `npx tsc --noEmit` — type check passes
2. `npm test` — all tests pass
3. No new lint errors in changed files

**Trio gates:**
1. `npx tsc --noEmit` — type check passes
2. `npm test` — all tests pass
3. PM condition: feature matches issue description (check issue body vs implementation)
4. Critic condition: no obvious regressions in adjacent code

**Blitz gates:**
1. `npx tsc --noEmit` — type check passes
2. `npm test` — critical tests pass (filter to changed file tests if possible)
3. No file conflicts between parallel agents

Print gate results:
```
[BW] #17 gates:
  [✓] type check
  [✓] tests (142 passed)
  [✓] PM: matches issue spec
  [✗] critic: regression in orchestrator.test.ts
[BW] ↻ fixing #17 (attempt 2)...
```

If gate fails: fix and retry. Max 3 attempts per issue.

After attempt 3, escalate:
```
[BW] #17 stuck after 3 attempts
[BW]   last failure: critic — regression in orchestrator.test.ts
[BW]   options:
    a) skip and continue pipeline
    b) create PR as draft (for manual review)
    c) halt pipeline
```

Update state after each gate check: `status: "verified"` or `attempts: N+1`

### 4d. Commit + PR
```bash
git add -A
git commit --signoff -m "feat: {description from issue} (#{N})"
git push -u origin feat/issue-{N}
gh pr create --title "{issue title} (#{N})" --body "Closes #{N}\n\n{summary of changes}"
```

Update state: `status: "pr_created"`, `pr: {prNumber}`

### 4e. CI + Merge
```bash
# Wait for CI
gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status
# Merge with rebase (keeps claude as author)
gh pr merge --rebase --delete-branch
# Close issue
gh issue close {N}
```

Update state: `status: "merged"`, `merged: true`

Print per-issue result and update task:
```
[BW] ✓ #17 → PR #34 merged (agent effectiveness scoring) [attempt 1]
```
```
TaskUpdate: status="completed"
```

### 4f. Write meeting log per issue
Append to `.bestwork/state/meeting.jsonl`:
```json
{"type":"issue","number":17,"scale":"trio","agents":["agent-engineer","pm-dx","critic-agent"],"status":"merged","pr":34,"attempts":1,"timestamp":"<ISO>"}
```

### 4g. Save checkpoint
After each issue completes or fails, update `.bestwork/state/pipeline-run.json` with current state. This enables `--resume` if the pipeline is interrupted.

## Step 5: Handle failures

If a PR fails CI after merge attempt:
1. Read the CI error (`gh run view --log-failed`)
2. Fix the issue on the same branch
3. Push + re-check CI
4. If still fails after 3 total attempts, offer options:
```
[BW] ✗ #16 — CI failed 3 times
[BW]   last error: {error summary}
[BW]   options:
    a) skip — continue to next issue
    b) draft PR — create as draft for manual review
    c) halt — stop pipeline entirely
```

Update state: `status: "skipped"` or `status: "draft"` with `error: "{reason}"`

## Step 6: Summary

```
[BW] ═══════════════════════════════════
[BW] pipeline complete
[BW]   ✓ 2/3 issues merged (#17, #18)
[BW]   ✗ 1/3 issues skipped (#16 — CI failure)
[BW]   PRs: #34, #35
[BW]   total attempts: 5 (avg 1.7 per issue)
[BW]   duration: 12m 34s
[BW] ═══════════════════════════════════
```

Update state: `completedAt: "<ISO timestamp>"`

## Step 7: Decisions log + meeting footer

Append to `.bestwork/context/decisions.md`:
```markdown
## {date}: Pipeline run
- **Issues**: #16, #17, #18
- **Result**: 2/3 merged, 1 skipped
- **PRs**: #34, #35
- **Attempts**: 5 total (1.7 avg)
- **Duration**: 12m 34s
- **Skipped**: #16 (CI failure — {reason})
```

Append meeting footer to `.bestwork/state/meeting.jsonl`:
```json
{"type":"footer","teamName":"pipeline-run","result":"2/3 merged","duration":"12m34s","timestamp":"<ISO>"}
```

## Rules

- ALWAYS use `git checkout main && git pull` before creating each branch
- ALWAYS use `--signoff` on commits
- ALWAYS use `gh pr merge --rebase --delete-branch` (not --squash, to keep claude author)
- ALWAYS use TaskCreate/TaskUpdate for each issue so user sees live progress spinners
- ALWAYS save state after each issue completes (checkpoint for resume)
- ALWAYS write meeting log entries (header per pipeline, entry per issue, footer at end)
- Independent issues CAN run in parallel (different branches)
- Dependent issues MUST run sequentially
- Max 3 gate-check attempts per issue before escalation
- Each retry attempt should try a DIFFERENT fix strategy
- git config must be claude/claude@anthropic.com (not user's name)
- State file enables `--resume` — never delete it until pipeline fully completes
- `--dry-run` must NEVER execute any git/gh commands beyond reading issues
