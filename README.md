# bestwork-agent

Harness engineering for Claude Code. Your agent types one line — the harness catches everything else.

<p align="center">
  <img src="https://img.shields.io/npm/v/bestwork-agent?color=cyan" alt="npm version" />
  <img src="https://img.shields.io/github/license/rlaope/bestwork-agent" alt="license" />
  <img src="https://img.shields.io/github/stars/rlaope/bestwork-agent?style=social" alt="stars" />
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
</p>

---

## The problem

AI coding agents hallucinate, loop, miss requirements, and ship security flaws. 45% of AI-generated code contains vulnerabilities (Veracode). Vibe-coded apps fail because nobody validated the idea before building.

**bestwork-agent** adds the quality gates that professional engineering teams use — without changing how you work.

## Benchmark: harness ON vs OFF

```
═══════════════════════════════════
  HARNESS EFFECTIVENESS BENCHMARK
═══════════════════════════════════

  Scenarios:      13
  Accuracy:       100.0%

  Harness ON:
    Catch rate:   100% (10/10)
    False pos:    0

  Harness OFF (vanilla):
    Catch rate:   0% (0/10)

  Categories:
    hallucination    3/4 caught
    platform         4/4 caught
    deprecated       1/1 caught
    security         1/1 caught
═══════════════════════════════════
```

Run it yourself: `npm run benchmark`

## What the harness does

| Gate | When | What it catches |
|------|------|-----------------|
| **Grounding** | PreToolUse (Edit/Write) | Editing files the agent hasn't read |
| **Scope lock** | PreToolUse | Edits outside the locked directory |
| **Strict mode** | PreToolUse | `rm -rf`, `git push --force` |
| **Type check** | PostToolUse (Edit/Write) | TypeScript errors after every change |
| **Review** | On demand / PostToolUse | Fake imports, hallucinated methods, platform mismatch, deprecated APIs, type safety bypass |
| **Requirement check** | PostToolUse (Edit/Write) | Unmet requirements from clarify/validate sessions |
| **Validate** | Before building | Evidence-based go/no-go — is this feature worth building? |

All gates run automatically. You just type your prompt.

## Install

### Option 1: Claude Code Plugin (recommended)

```bash
/plugin marketplace add https://github.com/rlaope/bestwork-agent
/plugin install bestwork-agent
```

### Option 2: npm

```bash
npm install -g bestwork-agent
bestwork install
```

## How it works

```
You: "Refactor the auth module to support OAuth2"
                    │
                    ▼
            ┌──────────────┐
            │ Smart Gateway │  classifies intent, allocates agents
            └──────┬───────┘
                   │
         ┌─────────┼──────────┐
         ▼         ▼          ▼
     PreToolUse  Execution  PostToolUse
     ┌─────────┐           ┌──────────┐
     │Grounding│           │Type check│
     │Scope    │           │Review    │
     │Strict   │           │Req check │
     └─────────┘           └──────────┘
```

The gateway analyzes your prompt and picks the right scale:

- **Solo** — simple fix, rename, format (1 agent)
- **Pair** — two related sub-tasks (2 agents + critic)
- **Trio** — multiple sub-tasks with quality gates (tech + PM + critic per task)
- **Hierarchy** — large scope, architecture decisions (CTO → Lead → Senior → Junior)
- **Squad** — localized feature, fast consensus (flat, parallel)

For non-solo work, the gateway shows you the plan and asks to confirm.

## 49 Domain Specialists

```bash
bestwork agents    # full catalog
```

**25 Tech**: backend, frontend, fullstack, infra, database, API, mobile, testing, security, performance, devops, data, ML, CLI, realtime, auth, migration, config, agent-engineer, plugin, accessibility, i18n, graphql, monorepo, writer

**10 PM**: product, API, platform, data, infra, migration, security, growth, compliance, DX

**14 Critic**: performance, scalability, security, consistency, reliability, testing, hallucination, DX, type safety, cost, accessibility, devsecops, i18n, agent

Agent prompts live in `prompts/` — edit without rebuilding.

## 22 Skills

Natural language or slash command — the gateway routes automatically.

| Skill | What it does |
|-------|-------------|
| `validate` | Evidence-based feature validation before building |
| `clarify` | Targeted requirement questions before execution |
| `review` | Hallucination and platform mismatch scan |
| `trio` | Parallel execution with quality gates |
| `plan` | Scope analysis and team recommendation |
| `delegate` | Autonomous execution without confirmation |
| `deliver` | Persistent completion — retry until done |
| `waterfall` | Sequential staged processing with gates |
| `blitz` | Maximum parallelism burst |
| `doctor` | Deploy config vs code integrity check |
| `pipeline-run` | Queue and auto-process multiple GitHub issues |
| `superthinking` | 1000-iteration thought simulation |

And 10 more: agents, changelog, docs, health, install, meetings, onboard, sessions, status, update.

## vs. other tools

| | bestwork-agent | CrewAI | MetaGPT | Vanilla Claude Code |
|---|---|---|---|---|
| **Target** | Claude Code users | General Python | General Python | Everyone |
| **Integration** | Native hooks (zero config) | Separate runtime | Separate runtime | Built-in |
| **Hallucination catch** | 100% (10/10 benchmark) | No built-in | No built-in | 0% |
| **Overhead** | ~0 (shell hooks) | 3x tokens | 2-5x tokens | 0 |
| **Feature validation** | Built-in (validate skill) | None | None | None |
| **Requirement tracking** | Auto (clarify → PostToolUse) | Manual | Manual | None |

## Harness Controls

```
./scope src/auth/       Lock edits to directory
./unlock                Remove lock
./strict                Block rm -rf, force read-before-edit
./relax                 Disable strict
./tdd add user auth     Test-driven development flow
./review                Hallucination scan
./validate              Is this feature worth building?
./clarify               Requirement deep-check before execution
```

## Observability

```bash
bestwork                  # TUI dashboard
bestwork sessions         # Session list
bestwork heatmap          # 365-day activity grid
bestwork loops            # Loop detection
bestwork replay <id>      # Session playback
bestwork effectiveness    # Prompt efficiency trend
```

## Notifications

```
./discord <webhook_url>
./slack <webhook_url>
```

Rich notifications per prompt: summary, git diff, review results, session health. Color-coded green/yellow/red.

## Security

Everything is local. No data leaves your machine. See [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
