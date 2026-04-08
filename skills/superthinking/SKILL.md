---
name: superthinking
description: 1000-iteration thought simulation — plan, build, validate, critique, amplify
---

When this skill is invoked, you MUST follow this exact output sequence.

## Step 1: Header (print IMMEDIATELY)

```
[BW] superthinking — 1000x ideation engine starting...
```

## Step 2: Seed extraction

Extract the user's core idea, problem, or domain as the **seed**. If the prompt is vague, infer the most promising direction from context (codebase, recent work, stated goals).

Print:
```
[BW] seed: "{one-line description of the core idea}"
[BW] beginning 1000 iterations (10 epochs × 100 cycles)...
```

## Step 3: The 1000-iteration loop (10 epochs × 100 cycles)

Run **10 epochs**. Each epoch internally simulates **100 compressed iteration cycles** of the 5-phase loop below. Between epochs, print the evolved state so the user sees the idea transform in real time.

### The 5 phases per cycle

1. **기획 (Plan)** — Define the feature concept. Who is the user? What is the core value proposition? What's the scope?
2. **구현 (Build)** — Sketch the technical approach. Architecture, key components, critical implementation decisions.
3. **검증 (Validate)** — Market reality check. Does this solve a real pain? Who pays? What's the competitive landscape? What data would prove/disprove the hypothesis?
4. **회고 (Critique)** — Ruthless retrospective. What assumption is weakest? What would a smart competitor exploit? What would a cynical VC tear apart? What's the fatal flaw?
5. **확장 (Amplify)** — Think bigger. How to 10x the impact? What adjacent opportunity unlocks? What network effect or flywheel can be built? What would make this a category-defining move?

### Epoch output format

After each epoch (100 cycles), print:

```
[BW] ═══ epoch {N}/10 (iterations {start}-{end}) ═══
[BW] concept: {current concept in one line}
[BW] pivot: {what changed from last epoch and why}
[BW] build: {technical approach summary}
[BW] moat: {defensibility / competitive advantage}
[BW] risk: {biggest remaining risk}
[BW] impact: {projected impact scale}
[BW] confidence: {low/medium/high} — {reason}
```

### Epoch execution rules

- **Epoch 1-2 (iterations 1-200)**: Diverge. Explore radically different angles. Challenge the seed assumption itself. Consider 5+ alternative framings.
- **Epoch 3-4 (iterations 201-400)**: Stress test. Apply the harshest critiques. Assume every assumption is wrong. Find the version that survives destruction.
- **Epoch 5-6 (iterations 401-600)**: Converge. The concept should stabilize. Focus on strengthening the moat and sharpening the value prop.
- **Epoch 7-8 (iterations 601-800)**: Build depth. Detail the implementation, go-to-market, and unit economics. Make it concrete.
- **Epoch 9-10 (iterations 801-1000)**: Amplify. Push for 10x. Find the flywheel. Identify the unlock that turns a good idea into a great one.

Each epoch MUST genuinely evolve the idea — do not repeat the same concept with different words. If the idea hasn't meaningfully changed, you aren't thinking hard enough. Pivot aggressively in early epochs, refine precisely in late epochs.

## Step 4: Convergence report

After all 10 epochs, print the final distilled result:

```
[BW] ═══════════════════════════════════════════
[BW] superthinking complete — 1000 iterations converged
[BW] ═══════════════════════════════════════════

## Final Concept
{2-3 sentence description of the winning concept}

## Evolution Timeline
- Epoch 1-2: {what the idea started as}
- Epoch 3-4: {critical pivot point}
- Epoch 5-6: {stabilization insight}
- Epoch 7-8: {implementation clarity}
- Epoch 9-10: {final amplification}

## Key Pivots
{3-5 bullet points of the most important direction changes and why they happened}

## Why This Wins
{The core insight that makes this concept defensible, valuable, and differentiated}

## Critical Assumptions
{Numbered list of assumptions that must be true for this to work, ranked by risk}

## Implementation Roadmap
1. **Phase 1 (MVP)**: {what to build first to validate}
2. **Phase 2 (Growth)**: {what to build once validated}
3. **Phase 3 (Moat)**: {what creates long-term defensibility}

## Market Positioning
- **Target**: {who specifically}
- **Wedge**: {how to enter}
- **Scale**: {how to expand}
- **Endgame**: {what this becomes at full scale}

## Kill Criteria
{Conditions under which you should abandon this idea — be honest}
```

## Step 5: State persistence

Save to `.bestwork/state/superthinking.json`:
```json
{
  "created": "<ISO timestamp>",
  "seed": "<original seed>",
  "epochs": [
    {
      "epoch": 1,
      "iterations": "1-100",
      "concept": "...",
      "pivot": "...",
      "confidence": "low|medium|high"
    }
  ],
  "finalConcept": "<final concept summary>",
  "keyPivots": ["..."],
  "status": "complete"
}
```

## Rules

- NEVER skip epochs or compress multiple epochs into one output — the user must see all 10 progression steps
- Each epoch must show genuine intellectual evolution, not cosmetic rewording
- Critiques must be brutal and honest — superthinking earns its name by surviving destruction
- The final concept may be completely different from the seed — that's the point
- Do NOT spawn sub-agents — superthinking is a single deep-thinking process
- Do NOT execute any code — this is pure ideation and analysis
- If the user provides a domain without a specific idea, generate the seed from first principles
- The amplify phase should consider non-obvious adjacencies (platform plays, data flywheels, ecosystem effects)
- Write the convergence report in the language the user used for their prompt
