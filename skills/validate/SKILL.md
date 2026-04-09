---
name: validate
description: Feature validation gate — research, define purpose, stress-test from real user perspective before building
---

When this skill is invoked, you MUST follow this exact output sequence.

## Step 1: Header (print IMMEDIATELY)

```
[BW] validate — is this really worth building?
```

## Step 2: Extract the feature hypothesis

Parse the user's request into a structured hypothesis:

```
[BW] hypothesis:
  Feature:  {what the user wants to build}
  Assumed problem: {what pain point it supposedly solves}
  Assumed user: {who supposedly needs this}
```

## Step 3: Evidence collection (parallel)

Spawn THREE parallel research agents to gather real evidence:

### 3a. Pain search (document-specialist agent)
Search the web for REAL user complaints about this problem:
- Reddit, HackerNews, GitHub Issues, Stack Overflow, Twitter/X
- Search terms: the problem (NOT the solution) — e.g. "frustrated with X", "X is broken", "wish X could"
- Collect: exact quotes, upvote counts, frequency of complaints, recency
- Flag: if you can only find 1-2 posts, that IS the finding — thin evidence

### 3b. Alternative scan (document-specialist agent)
Search for existing solutions to this problem:
- Direct competitors / existing tools that solve this
- Workarounds users have already built
- Why existing solutions fail (or succeed) — what's the gap?
- If good solutions already exist: why would ours be different?

### 3c. Anti-evidence search (document-specialist agent)
Actively search for reasons this feature might NOT be needed:
- Users who explicitly say they DON'T want this
- Projects that built this and failed / removed it
- Counter-arguments, downsides, unintended consequences
- "X is a solution looking for a problem" signals

## Step 4: Evidence report

Print the raw findings:

```
[BW] ═══════════════════════════════════
[BW] evidence report
[BW] ═══════════════════════════════════

## Real pain (from actual users)
- {quote 1} — {source, upvotes, date}
- {quote 2} — {source, upvotes, date}
- ...
Total signals found: {N}
Signal strength: {weak / moderate / strong}

## Existing alternatives
- {tool/workaround 1} — {how it solves the problem, why it falls short}
- {tool/workaround 2} — ...
Gap exists: {yes/no — is there a real unmet need?}

## Anti-evidence
- {reason 1 this might not be needed}
- {reason 2}
- ...
```

## Step 5: Purpose definition (CRITICAL)

This is the step most vibe coders skip entirely. Force the user to answer:

Use AskUserQuestion:
```
[BW] validate — purpose check

Based on the evidence above, define your feature's PURPOSE before we continue.
Answer these 3 questions (1 sentence each):

1. PHILOSOPHY: Why does this deserve to exist? (not "what does it do" — WHY)
2. EXPERIENCE: What moment of relief/delight does the user feel when using this?
3. MEASURE: How will you know this succeeded? (specific, observable signal)

Without clear answers, this feature risks becoming "just another thing that exists."
```

## Step 6: Validation scoring

After the user answers, score on 5 dimensions:

| Dimension | Weight | Score | What it measures |
|-----------|--------|-------|------------------|
| **Pain evidence** | 30% | 0-100 | Do real users actually complain about this? |
| **Gap** | 25% | 0-100 | Do existing solutions fail to solve it? |
| **Purpose clarity** | 20% | 0-100 | Can the builder articulate WHY, not just WHAT? |
| **Anti-evidence** | 15% | 0-100 | How strong are the reasons NOT to build? (inverted) |
| **Feasibility** | 10% | 0-100 | Can this actually be built well with current resources? |

```
[BW] validation scorecard:
  Pain evidence:  {score}% — {reason}
  Gap:            {score}% — {reason}
  Purpose:        {score}% — {reason}
  Anti-evidence:  {score}% — {reason} (lower = more counter-evidence)
  Feasibility:    {score}% — {reason}
  ─────────────────
  Overall:        {weighted score}%
```

### Verdict thresholds
- **80%+**: `[BW] VALIDATED — strong evidence, clear purpose. Build it.`
- **60-79%**: `[BW] CONDITIONAL — evidence exists but gaps remain. Recommend narrowing scope or gathering more data before building.`
- **40-59%**: `[BW] WEAK — thin evidence or unclear purpose. Strongly recommend more research before committing code.`
- **<40%**: `[BW] REJECTED — insufficient evidence this is worth building. Save your time.`

## Step 7: Recommendation

```
[BW] ═══════════════════════════════════
[BW] validate complete — verdict: {VALIDATED/CONDITIONAL/WEAK/REJECTED}
[BW] ═══════════════════════════════════

## What the evidence says
{2-3 sentence summary of the honest truth}

## If you proceed
- Narrowed scope: {what to build FIRST based on strongest evidence}
- Skip: {what to NOT build — low evidence parts}
- Risk: {biggest risk to watch for}

## If you pause
- Research next: {specific questions still unanswered}
- Test with: {how to validate cheaply before building}
```

## Step 8: Next steps

```
[BW] next:
  a) build — proceed with narrowed scope
  b) research more — dig deeper into weak areas
  c) pivot — reframe the problem based on findings
  d) drop — not worth building right now
```

If user picks (a): route to execution with the narrowed scope, NOT the original broad idea.
If user picks (b): loop back to Step 3 with refined search terms.

## Step 9: State persistence

Save to `.bestwork/state/validate.json`:
```json
{
  "created": "<ISO timestamp>",
  "hypothesis": {
    "feature": "...",
    "assumedProblem": "...",
    "assumedUser": "..."
  },
  "evidence": {
    "painSignals": [],
    "alternatives": [],
    "antiEvidence": []
  },
  "purpose": {
    "philosophy": "...",
    "experience": "...",
    "measure": "..."
  },
  "scores": {
    "painEvidence": 0,
    "gap": 0,
    "purposeClarity": 0,
    "antiEvidence": 0,
    "feasibility": 0,
    "overall": 0
  },
  "verdict": "VALIDATED|CONDITIONAL|WEAK|REJECTED",
  "decision": "build|research|pivot|drop",
  "status": "complete"
}
```

## Rules

- NEVER skip the evidence collection — "I think users want this" is not evidence
- NEVER score pain evidence above 50% with fewer than 5 independent user signals
- NEVER let the user skip the purpose definition (Step 5) — this is the whole point
- ALWAYS search for ANTI-evidence — confirmation bias is the enemy
- ALWAYS present evidence BEFORE asking for purpose — let data inform the answer
- ALWAYS recommend narrowed scope on CONDITIONAL — don't greenlight the full vision on thin evidence
- Quotes from real users are REQUIRED — paraphrasing doesn't count
- If web search fails or returns nothing: that IS the finding (no evidence = weak pain signal)
- The goal is honest assessment, not cheerleading — a REJECTED verdict saves more time than a failed launch
- Evidence older than 2 years should be flagged as potentially stale
- High upvote/engagement on pain posts counts more than many low-engagement posts
