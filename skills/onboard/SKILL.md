---
name: onboard
description: First-time setup guide and feature walkthrough
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] welcome to bestwork-agent! let's get you set up.
```

Walk through:
1. **What it does**: bestwork-agent organizes your AI into specialist teams — Tech, PM, Critic
2. **Quick setup**:
   - Plugin (recommended): `/plugin marketplace add https://github.com/rlaope/bestwork-agent` then `/plugin install bestwork-agent`
   - npm: `npm install -g bestwork-agent && bestwork install`
3. **Key commands**:
   - `/bestwork-agent:trio` — parallel execution with quality gates
   - `/bestwork-agent:review` — hallucination scanner
   - `/bestwork-agent:agents` — see all 49 specialist agents
   - `/bestwork-agent:health` — session health check
   - `./discord <url>` or `./slack <url>` — notification setup
4. **Team modes**: hierarchy (CTO → Lead → Senior → Junior) vs squad (flat, parallel)

After done, print:
```
[BW] onboarding complete. you're ready to go. try /bestwork-agent:trio first.
```
