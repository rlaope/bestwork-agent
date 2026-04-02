---
description: Execute tasks in parallel with Tech + PM + Critic quality gates
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] assembling trio — Tech + PM + Critic per task...
```

Usage: `./trio task1 | task2 | task3`

For EACH task, print:
```
[BW] task {N}: "{task}" → deploying {tech-agent} + {pm-agent} + {critic-agent}
```

Each task gets a matched specialist trio from 46 agent profiles:
- **Tech** — implements with domain expertise
- **PM** — verifies requirements are met
- **Critic** — reviews quality + catches hallucinations

Feedback loop: if PM or Critic rejects, print:
```
[BW] task {N}: critic rejected — feeding back to tech (round {M}/3)
```

When all tasks done, print:
```
[BW] trio complete. {N} tasks, {M} iterations, {K} approved.
```
