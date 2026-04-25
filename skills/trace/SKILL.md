---
name: trace
description: Evidence-driven causal tracing — competing hypotheses, falsification, rebuttal round, recommended next probes
---

When this skill is invoked, you MUST follow this exact output sequence. Trace is for diagnosing WHY something happens, not just describing what happens. Every claim is anchored to evidence with a stated strength.

## Step 1: Header (print IMMEDIATELY)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[BW] trace — evidence-driven analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Step 2: State the question

Restate the user's question as a single causal question of the form: "Why does X happen?" or "What caused Y?". If the prompt is purely descriptive, mark this skill not applicable and stop.

## Step 3: Generate at least 3 hypotheses

List at least three plausible causes. They must be mutually distinguishable — each must predict something the others don't. Vague causes ("bug somewhere") are not hypotheses; refine until each one is testable.

```
H1: <specific cause>
H2: <specific cause — different mechanism, not a rephrase>
H3: <specific cause — different mechanism>
```

## Step 4: For each hypothesis, gather evidence FOR and AGAINST

For every hypothesis produce a structured block:

```
H1: <hypothesis>
  FOR:
    - [evidence] — strength: <see hierarchy below> — source: <file:line | command output | doc URL>
  AGAINST:
    - [evidence] — strength: <hierarchy> — source: <...>
  Distinctive prediction:
    If H1 is true, we should ALSO observe <X>. If we observe <not-X>, H1 is falsified.
  Cheapest discriminating probe:
    Run <command or one-line check> to test the prediction.
```

Evidence strength hierarchy (use these exact labels):
- **controlled-repro** — you reproduced the failure deterministically with a minimal input
- **primary-artifact** — log line, stack trace, diff, or test output observed directly NOW
- **multi-source** — two or more independent artifacts agree
- **inference** — reasoning from documented behavior, not direct observation
- **circumstantial** — pattern fits but no direct artifact
- **intuition** — gut feeling; explicitly weakest, never the basis for a verdict

## Step 5: Pick the leader

Identify the hypothesis with the strongest FOR / weakest AGAINST. State the gap between leader and runner-up: "leader: H2 (controlled-repro + primary-artifact); runner-up: H1 (inference only)".

## Step 6: Rebuttal round (mandatory)

Steelman the strongest alternative. Argue against the leader using the alternative's best evidence. The leader survives only if the rebuttal cannot produce a distinctive prediction the leader fails. If the rebuttal lands a hit, downgrade the leader's confidence and revisit Step 5.

## Step 7: Verdict + next probe

```
Verdict: <leader hypothesis>
Confidence: high | medium | low
Reason: <one sentence tying the strongest evidence to the conclusion>
Next probe: <single concrete command or check to confirm or refute>
```

If confidence is **low**, the verdict is "inconclusive — run the next probe before acting" and you stop. Never recommend a fix from a low-confidence trace.

## Anti-patterns

- **Single-hypothesis trace.** If you only consider one cause, you are not tracing, you are confirming a guess. Always at least three.
- **Same-source double-counting.** Two grep hits in the same file are still one source for evidence-strength purposes.
- **Hidden assumption.** If the trace only works under "assuming X is true," X is itself a hypothesis. Surface it.
- **Skipping the rebuttal.** A leader without a rebuttal round is not a leader — it is the only one you bothered to check.
- **Action before verdict.** Do not edit code, propose patches, or open a PR until Step 7 produces a non-low confidence verdict.

## Good entry cases

- "This test fails intermittently — why?"
- "The deploy succeeded but users see 502s — what changed?"
- "This regression appeared between commit A and B — which commit caused it?"
- "This metric spiked at 14:00 — what's the cause?"

## Skip this skill when

- The prompt is descriptive ("show me the auth flow") — use plan or review.
- The prompt asks for a fix without a diagnosis — use clarify first.
- A primary artifact already names the cause — just fix it.
