---
name: clarify
description: Ask targeted clarifying questions to uncover missed requirements before execution
---

When this skill is invoked, you MUST follow this exact output sequence.

## Step 1: Header (print IMMEDIATELY)

```
[BW] clarify — requirement deep-check before execution...
```

## Step 2: Analyze the request

Before asking any question, do TWO things silently:

### 2a. Codebase exploration
If the request involves existing code, spawn an Explore agent to understand the current state:
- Affected files and their structure
- Existing patterns and conventions
- Adjacent code that might be impacted

NEVER ask the user about something you can find in the codebase yourself.

### 2b. Dimension scoring
Score the request on 4 dimensions (0-100):

| Dimension | Weight | What it measures |
|-----------|--------|------------------|
| **Goal** | 40% | Is the primary objective unambiguous? |
| **Scope** | 25% | What's in and what's out? |
| **Criteria** | 20% | How do we know it's done correctly? |
| **Risk** | 15% | What constraints, edge cases, or failure modes exist? |

Print the initial assessment:
```
[BW] clarity assessment:
  Goal:     {score}% — {brief reason}
  Scope:    {score}% — {brief reason}
  Criteria: {score}% — {brief reason}
  Risk:     {score}% — {brief reason}
  ─────────────────
  Overall:  {weighted score}%
```

### 2c. Auto-pass check
If overall score >= 80%: skip to Step 4 (no questions needed).
```
[BW] ✓ requirements clear enough — proceeding without questions
```

If the request contains concrete signals (file paths, function names, error messages, numbered steps, acceptance criteria), boost the score accordingly.

## Step 3: Question loop (max 5 rounds)

Ask ONE question per round, targeting the **lowest-scoring dimension**.

### Question format
Use AskUserQuestion for each question:
```
[BW] clarify round {N}/5 — targeting: {dimension} ({score}%)

{The question — specific, actionable, not generic}

Hints (if applicable):
- {option A based on codebase context}
- {option B}
- {option C}

(say "go" to skip remaining questions and start execution)
```

### Question rules
- **Target the weakest dimension** — always explain WHY this question matters
- **ONE question per round** — never batch multiple questions
- **Be specific, not generic** — BAD: "What are the requirements?" GOOD: "The user model has email and phone — should auth support both, or email-only?"
- **Offer concrete options** — when the codebase reveals possible paths, list them as hints
- **Build on prior answers** — each question should incorporate what you learned from previous rounds
- **Never ask about codebase facts** — if you can read the code to find out, do that instead of asking

### After each answer
1. Re-score the targeted dimension based on the answer
2. Check if any NEW dimension dropped (the answer may reveal new ambiguity)
3. Print updated scores:
```
[BW] clarity update:
  Goal:     85% (+15) ✓
  Scope:    45% (+0)  ← next target
  Criteria: 60% (+10)
  Risk:     30% (+0)
  ─────────────────
  Overall:  60%
```

### Exit conditions
Stop the question loop when:
- Overall score >= 80% → proceed with confidence
- User says "go", "skip", "enough", "시작", "됐어", "ㄱㄱ" → proceed with current understanding
- 5 rounds completed → proceed with what you have, flag remaining gaps

## Step 4: Clarification summary

Print the final requirements spec:

```
[BW] ═══════════════════════════════════
[BW] clarify complete — {N} rounds, {overall}% clarity
[BW] ═══════════════════════════════════

## Requirements (confirmed)
{Bullet list of confirmed requirements from the original request + answers}

## Decisions made
{Bullet list of decisions from the Q&A that resolved ambiguity}

## Open gaps (if any)
{Bullet list of remaining low-score areas — flagged but not blocking}

## Recommended execution
- Mode: {solo/trio/blitz based on scope}
- Agents: {recommended agent list}
```

## Step 5: Execution bridge

After the summary, offer next steps:
```
[BW] next:
  a) execute now — proceed with these requirements
  b) ask more — continue clarifying
  c) save spec — save to .bestwork/specs/ and decide later
```

If user picks (a): route to the appropriate execution skill (delegate/trio/blitz/deliver) based on the classified scope.
If user picks (c): save to `.bestwork/specs/{timestamp}-{slug}.md`.

## Step 6: State persistence

Save clarification state to `.bestwork/state/clarify.json`:
```json
{
  "created": "<ISO timestamp>",
  "originalRequest": "<user's original prompt>",
  "rounds": [
    {
      "round": 1,
      "dimension": "scope",
      "question": "...",
      "answer": "...",
      "scoreDelta": { "scope": 25 }
    }
  ],
  "finalScores": { "goal": 90, "scope": 75, "criteria": 85, "risk": 60 },
  "overallScore": 80,
  "decisions": ["..."],
  "openGaps": ["..."],
  "status": "complete"
}
```

## Rules

- NEVER ask more than 5 questions — this is clarify, not an interrogation
- NEVER ask about things you can read from the codebase — explore first, ask second
- NEVER ask generic questions ("What are the requirements?") — be specific and contextual
- ALWAYS offer concrete options/hints when the codebase suggests possible paths
- ALWAYS target the lowest-scoring dimension — explain why that dimension matters
- ALWAYS allow the user to skip ("go") at any point — respect their time
- ALWAYS re-score after each answer — show progress transparently
- The auto-pass threshold (80%) should prevent unnecessary questioning on clear requests
- If the user provides a spec/PRD/issue with clear acceptance criteria, auto-pass immediately
- Questions should uncover RISKS and EDGE CASES that the user may not have considered, not just restate what they said
