---
name: plan
description: Analyze task scope and recommend a bestwork team composition before executing
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] analyzing scope...
```

The user's request follows after the skill invocation. Analyze it thoroughly before doing anything.

## Phase 1: Scope Analysis

Gather concrete data about what the task requires. Do ALL of the following:

1. **Identify affected files** — based on the user's request, determine which files will need to be created, modified, or deleted. Use `git ls-files`, `find`, and your knowledge of the codebase to list them. Count them.

2. **Identify domains** — classify each file into a domain:
   - backend (APIs, DB, auth, server logic)
   - frontend (UI, components, CSS, client logic)
   - infra (CI/CD, Docker, cloud config, deployment)
   - data (pipelines, ETL, migrations, schemas)
   - ai/ml (models, embeddings, inference)
   - cli (CLI tools, scripts, shell)
   - testing (test files, fixtures, mocks)
   - docs (documentation, README, comments)
   - config (bundler, TypeScript, linting, package.json)
   - security (auth, encryption, OWASP)

3. **Estimate complexity** — score 1-5 based on:
   - Concurrency or state management involved? +1
   - External API integrations? +1
   - Security-sensitive (auth, payments, PII)? +1
   - Cross-platform concerns? +1
   - Database migrations or schema changes? +1

## Phase 2: Team Recommendation

Based on the analysis, recommend ONE team mode:

### SOLO (1 specialist) — small scope
Conditions: 1-2 files, single domain, complexity 1-2.

Pick the best-fit specialist from:
- tech-backend, tech-frontend, tech-fullstack, tech-infra, tech-database, tech-api, tech-mobile, tech-testing, tech-security, tech-performance, tech-devops, tech-data, tech-ml, tech-cli, tech-realtime, tech-auth, tech-migration, tech-config, tech-writer, tech-graphql, tech-monorepo, tech-accessibility, tech-i18n, tech-agent-engineer, tech-plugin

Print:
```
[BW] plan: SOLO
     scope: {N} files, {domain}
     complexity: {score}/5
     agent: {specialist}
     
     tasks:
       1. {what will be done}
       2. {what will be done}

     confirm? (y/n)
```

### PAIR (2 specialists) — medium scope
Conditions: 3-5 files, 2 domains, complexity 2-3.

Pick 2 complementary specialists. Common combos:
- tech-backend + tech-frontend (fullstack feature)
- tech-backend + tech-infra (backend + deployment)
- tech-backend + tech-database (API + schema)
- tech-api + tech-frontend (API contract + UI)
- tech-cli + tech-config (tooling)

Print:
```
[BW] plan: PAIR
     scope: {N} files across {domains}
     complexity: {score}/5
     agents: {specialist1} + {specialist2}
     
     tasks:
       1. [{agent}] {what will be done}
       2. [{agent}] {what will be done}

     confirm? (y/n)
```

### TRIO (Tech + PM + Critic) — large scope
Conditions: 5-10 files, 3+ domains, complexity 3-4, or any task benefiting from quality gates.

Pick the best-fit trio from all 49 specialists:
- **Tech**: one of the 25 tech-* specialists
- **PM**: one of pm-product, pm-api, pm-platform, pm-data, pm-infra, pm-migration, pm-security, pm-growth, pm-compliance, pm-dx
- **Critic**: one of critic-perf, critic-scale, critic-security, critic-consistency, critic-reliability, critic-testing, critic-hallucination, critic-dx, critic-type, critic-cost, critic-accessibility, critic-devsecops, critic-i18n, critic-agent

Print:
```
[BW] plan: TRIO
     scope: {N} files across {domains}
     complexity: {score}/5
     agents:
       tech:   {tech-specialist}  — implements
       pm:     {pm-specialist}    — verifies requirements
       critic: {critic-specialist} — reviews quality
     
     execution:
       1. [{tech}] {implementation task}
       2. [{pm}] verify: {what PM checks}
       3. [{critic}] review: {what critic checks}
       (max 3 feedback rounds if rejected)

     confirm? (y/n)
```

### SQUAD (4+ flat) — extra-large scope, multi-domain
Conditions: 10+ files, 4+ domains, complexity 4-5, feature work.

Pick a squad preset or custom composition:
- **Feature Squad**: tech-backend + tech-frontend + pm-product + critic-dx
- **Infra Squad**: tech-infra + tech-devops + pm-infra + critic-reliability
- **Security Squad**: tech-security + tech-auth + pm-security + critic-security
- **Data Squad**: tech-data + tech-database + pm-data + critic-cost
- **Custom**: pick 4-6 specialists that cover all identified domains

Print:
```
[BW] plan: SQUAD
     scope: {N} files across {domains}
     complexity: {score}/5
     squad: {preset or "custom"}
       - {specialist1} ({role})
       - {specialist2} ({role})
       - {specialist3} ({role})
       - {specialist4} ({role})
     
     execution (parallel):
       1. [{agent1}] {task}
       2. [{agent2}] {task}
       3. [{agent3}] {task}
       4. [{agent4}] {task}
     resolution: majority vote on disagreements

     confirm? (y/n)
```

### HIERARCHY (CTO chain) — architecture-level
Conditions: 10+ files, architecture changes, complexity 5, refactoring, or security-critical.

Pick a hierarchy preset:
- **Full Team**: CTO -> Tech Lead -> Senior -> Junior
- **Backend Team**: Backend Lead -> Senior Backend -> Junior Backend
- **Frontend Team**: Frontend Lead -> Senior Frontend -> Junior Frontend
- **Security Team**: CISO -> Security Lead -> Security Engineer

Print:
```
[BW] plan: HIERARCHY
     scope: {N} files, architecture-level
     complexity: {score}/5
     chain: {preset}
       4. {C-level}     — final approval
       3. {Lead}        — architecture review
       2. {Senior}      — implementation review
       1. {Junior}      — implementation
     
     execution (bottom-up, review top-down):
       1. [{junior}] implement: {task}
       2. [{senior}] review + improve
       3. [{lead}] architecture check
       4. [{c-level}] final decision
     
     confirm? (y/n)
```

## Phase 3: Confirmation

Wait for user input. Accept:
- **y / yes / go / ok** — proceed to execution
- **n / no / cancel** — abort, print `[BW] plan cancelled.`
- **solo / pair / trio / squad / hierarchy** — override the recommended mode, re-display plan with the forced mode
- **swap {agent} for {agent}** — replace a specialist, re-display plan
- Any other feedback — adjust the plan and re-display

## Phase 3.5: Persist Plan

Before execution, ALWAYS save the plan to disk:

```bash
mkdir -p .bestwork/plans
```

Write the plan as JSON to `.bestwork/plans/<timestamp>-<slug>.json`:
```json
{
  "created": "<ISO timestamp>",
  "task": "<user's original request>",
  "mode": "solo|pair|trio|squad|hierarchy",
  "scope": { "files": ["..."], "domains": ["..."], "complexity": N },
  "agents": [{ "name": "tech-backend", "role": "tech", "tasks": ["..."] }],
  "status": "pending|executing|complete|cancelled"
}
```

Also write a human-readable summary to `.bestwork/plans/<timestamp>-<slug>.md`.

This enables:
- `./plan --last` — re-load and resume the most recent plan
- `./plan --list` — list all saved plans
- Plans can be picked up in a new session if the current one dies

When the user says `./plan --last`:
1. Read the latest `.json` file from `.bestwork/plans/`
2. Print the plan summary
3. Ask: "resume this plan? (y/n)"
4. If yes, jump to Phase 4 execution

## Phase 4: Execution

Once confirmed, update the saved plan's status to "executing". Then route to the appropriate team mode. Print:

```
[BW] executing plan...
```

Then execute based on the confirmed mode:

- **SOLO**: Load the specialist's prompt from `prompts/tech/{name}.md` (or the matching category). Execute the task directly using that agent's expertise and perspective.

- **PAIR**: Execute sequentially — first specialist handles their domain files, second specialist handles theirs. Cross-review at the end.

- **TRIO**: Execute as `./trio` — spawn Tech agent (implement), PM agent (verify), Critic agent (review). Feedback loop up to 3 rounds. Record to meeting log at `.bestwork/state/meeting.jsonl`.

- **SQUAD**: Spawn all agents in parallel using `run_in_background`. Each agent works on their assigned files. Disagreements resolved by majority vote. Record to meeting log.

- **HIERARCHY**: Execute bottom-up (Junior implements first), review top-down (C-level approves last). Each level can send work back down with feedback. Record to meeting log.

For trio/squad/hierarchy, write the meeting log:
```bash
mkdir -p ~/.bestwork/state && echo '{"type":"header","teamName":"plan","mode":"<MODE>","task":"<TASK>","classification":"PLAN","developerCount":<N>,"routingReason":"plan skill recommendation"}' > .bestwork/state/meeting.jsonl
```

After execution completes, update the saved plan's status to "complete" and print:
```
[BW] plan complete. mode={MODE}, agents={N}, files={N}.
     saved: .bestwork/plans/<filename>.md
```
