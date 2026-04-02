---
description: Execute tasks in parallel with Tech + PM + Critic quality gates
---

Usage: `./trio task1 | task2 | task3`

Each task gets a matched specialist trio from 36 agent profiles:
- **Tech** — implements with domain expertise
- **PM** — verifies requirements are met
- **Critic** — reviews quality + catches hallucinations

Feedback loop: if PM or Critic rejects, Tech fixes and re-submits (max 3 rounds). Hallucination critic is always included.

Example:
```
./trio implement auth API | add rate limiting | write integration tests
```
