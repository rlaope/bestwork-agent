---
name: pipeline-run
description: Queue and auto-process multiple GitHub issues — each gets its own branch, team, PR, and merge
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] pipeline starting...
```

## Step 1: Resolve issues

The user can provide:
- Explicit issue numbers: `./pipeline #16 #17 #18`
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
Then filter based on user intent (e.g., "v2.0" → filter by title/label matching v2.0).

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
- **Dependencies**: does this issue depend on another queued issue?

Print classification:
```
[BW] #16 → blitz (34 prompt files, tech-writer)
[BW] #17 → trio (agent-engineer + pm-dx + critic-agent)
[BW] #18 → solo (tech-plugin)
```

## Step 3: Process each issue

For EACH issue (independent ones in parallel via Agent run_in_background):

### 3a. Branch
```bash
git checkout main && git pull && git checkout -b feat/issue-{N}
```

### 3b. Execute
Based on the classification:
- **solo**: single agent implements directly
- **trio**: Tech implements → PM verifies → Critic reviews (max 3 rounds)
- **blitz**: spawn all agents in parallel

Use TaskCreate for each issue so user sees progress spinners:
```
TaskCreate: subject="#N {title}", activeForm="processing #N..."
```

### 3c. Verify
```bash
npm run build && npm test
```
If tests fail, fix and retry (max 2 retries).

### 3d. Commit + PR
```bash
git add -A
git commit --signoff -m "feat: {description from issue} (#{N})"
git push -u origin feat/issue-{N}
gh pr create --title "{issue title} (#{N})" --body "Closes #{N}\n\n{summary of changes}"
```

### 3e. CI + Merge
```bash
# Wait for CI
gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status
# Merge with rebase (keeps claude as author, no 잔디)
gh pr merge --rebase --delete-branch
# Close issue
gh issue close {N}
```

Print per-issue result:
```
[BW] ✓ #17 → PR #34 merged (agent effectiveness scoring)
[BW] ✗ #16 → PR #35 CI failed (retrying...)
[BW] ✓ #16 → PR #35 merged on retry
```

## Step 4: Handle failures

If a PR fails CI:
1. Read the CI error (`gh run view --log-failed`)
2. Fix the issue on the same branch
3. Push + re-check CI
4. If still fails after 2 retries, skip and report:
```
[BW] ✗ #16 — skipped after 2 failed attempts. Manual review needed.
```

## Step 5: Summary

```
[BW] ═══════════════════════════════════
[BW] pipeline complete
[BW]   ✓ 2/3 issues merged
[BW]   ✗ 1/3 issues skipped (CI failure)
[BW]   PRs: #34, #35
[BW] ═══════════════════════════════════
```

## Step 6: Decisions log

Append to `.bestwork/context/decisions.md`:
```markdown
## {date}: Pipeline run
- **Issues**: #16, #17, #18
- **Result**: 2/3 merged, 1 skipped
- **PRs**: #34, #35
```

## Rules

- ALWAYS use `git checkout main && git pull` before creating each branch
- ALWAYS use `--signoff` on commits
- ALWAYS use `gh pr merge --rebase --delete-branch` (not --squash, to keep claude author)
- ALWAYS use TaskCreate/TaskUpdate for each issue so user sees progress
- Independent issues CAN run in parallel (different branches)
- Dependent issues MUST run sequentially
- Max 2 CI retry attempts per issue before skipping
- git config must be claude/claude@anthropic.com (not user's name)
