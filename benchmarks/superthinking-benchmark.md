# Superthinking Benchmark

## Token Budget Estimation

### Per-Epoch Output
| Section | Est. Tokens |
|---------|-------------|
| Epoch header | ~10 |
| concept (1 line) | ~20 |
| pivot (1 line) | ~30 |
| build (1 line) | ~25 |
| moat (1 line) | ~20 |
| risk (1 line) | ~20 |
| impact (1 line) | ~15 |
| confidence (1 line) | ~15 |
| **Subtotal per epoch** | **~155** |

### Convergence Report
| Section | Est. Tokens |
|---------|-------------|
| Final Concept | ~80 |
| Evolution Timeline | ~150 |
| Key Pivots | ~120 |
| Why This Wins | ~80 |
| Critical Assumptions | ~100 |
| Implementation Roadmap | ~150 |
| Market Positioning | ~100 |
| Kill Criteria | ~60 |
| **Subtotal** | **~840** |

### Total Estimate
| Component | Tokens |
|-----------|--------|
| Header + seed | ~50 |
| 10 epochs × ~155 | ~1,550 |
| Internal reasoning (10 epochs × ~500) | ~5,000 |
| Convergence report | ~840 |
| State JSON | ~200 |
| **Total output** | **~7,640** |
| **Total with reasoning** | **~12,000–15,000** |

### Context Window Impact
- Model: Claude Opus 4.6 (1M context)
- Superthinking uses ~1.5% of available context
- Safe for any conversation state

## Quality Benchmarks

### Epoch Evolution Criteria
Each epoch MUST show measurable evolution. Score each epoch 0-3:

| Score | Meaning |
|-------|---------|
| 0 | Same idea, cosmetic rewording |
| 1 | Minor refinement (adjusted scope, tweaked target) |
| 2 | Meaningful pivot (new angle, killed an assumption) |
| 3 | Paradigm shift (fundamentally different framing) |

**Target distribution across 10 epochs:**
- Epochs 1-2: Score 2-3 (divergent exploration)
- Epochs 3-4: Score 2-3 (destruction/survival)
- Epochs 5-6: Score 1-2 (convergence)
- Epochs 7-8: Score 1 (deepening)
- Epochs 9-10: Score 1-2 (amplification)

**Minimum quality bar:** Average score >= 1.5 across all epochs (cosmetic repetition = fail)

### Convergence Report Quality Checklist
- [ ] Final concept is clearly different from initial seed
- [ ] At least 3 distinct pivots identified
- [ ] Kill criteria are honest (not straw-man easy conditions)
- [ ] Implementation roadmap is actionable (not generic platitudes)
- [ ] Market positioning names specific competitors or alternatives
- [ ] Critical assumptions are falsifiable (can be tested)

### Anti-Patterns to Detect
1. **Echo chamber**: Every epoch says the same thing differently
2. **Toothless critique**: "The risk is that it might not work" — not specific enough
3. **Scope creep**: Idea grows without sharpening — adding features instead of refining
4. **Generic amplification**: "Add AI" / "Use blockchain" without specific mechanism
5. **Happy path only**: No mention of failure modes or competition

## Comparison Baseline

To evaluate superthinking quality, compare against:

| Method | Depth | Pivots | Time |
|--------|-------|--------|------|
| Single prompt "come up with a feature" | Low | 0 | 30s |
| 3-round brainstorm | Medium | 1-2 | 5min |
| **Superthinking (1000x)** | **High** | **3-5** | **2-3min** |

The value proposition: superthinking should produce ideas that a human brainstorming session would take 2-4 hours to reach, compressed into ~3 minutes of LLM reasoning.
