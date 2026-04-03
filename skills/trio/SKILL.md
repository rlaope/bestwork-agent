---
name: trio
description: Execute tasks in parallel with dynamically assigned agents per task
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] assembling team — dynamic agent allocation per task...
```

Usage: `./trio task1 | task2 | task3`

The gateway analyzes each task and assigns 1-5 agents based on what's needed:
- Simple task → 1 tech agent
- Standard task → tech + critic (quality review)
- Complex task → tech + pm (requirements) + critic (quality)
- Critical task → tech + pm + critic + lead (architecture)

For EACH task, print:
```
[BW] task {N}: "{task}" → [{agent1}, {agent2}, ...]
```

All tasks run in parallel. Each task's agents collaborate:
- **Tech** — implements with domain expertise
- **PM** (if assigned) — verifies requirements are met
- **Critic** (if assigned) — reviews quality + catches hallucinations

Feedback loop: if PM or Critic rejects, print:
```
[BW] task {N}: critic rejected — feeding back to tech (round {M}/3)
```

When all tasks done, print:
```
[BW] complete. {N} tasks, {M} total agents, {K} iterations, {J} approved.
```
