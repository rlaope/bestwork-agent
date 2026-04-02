# bestwork-agent

**now you see me** — best harness engineering for Claude Code. work like a corporation team, not just a club.

<p align="center">
  <img src="https://img.shields.io/npm/v/bestwork-agent?color=cyan" alt="npm version" />
  <img src="https://img.shields.io/github/license/rlaope/bestwork-agent" alt="license" />
  <img src="https://img.shields.io/github/stars/rlaope/bestwork-agent?style=social" alt="stars" />
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
</p>

---

Your AI agent works alone. It hallucinates, loops, misses requirements, and you don't know until it's too late.

**bestwork** turns it into a team. Every task gets a **Tech** (engineer), **PM** (product manager), and **Critic** (quality reviewer) — specialist agents matched to the domain. 36 profiles. Auto-selected. Parallel execution. Feedback loops. Real notifications.

## Install

```bash
npm install -g bestwork-agent
bestwork install
```

Restart Claude Code. Type `./help` to see everything.

---

## Harness

### Trio Execution — your AI corporation

```
./trio implement auth API | add rate limiting | write integration tests
```

Each task gets a matched specialist trio:

| Task | Tech | PM | Critic |
|------|------|----|--------|
| auth API | tech-auth | pm-security | critic-security + critic-hallucination |
| rate limiting | tech-performance | pm-api | critic-scale + critic-hallucination |
| integration tests | tech-testing | pm-product | critic-testing + critic-hallucination |

- **Tech** implements with domain expertise
- **PM** verifies requirements are met
- **Critic** reviews quality + catches hallucinations
- Rejected? Feedback loop → Tech fixes → re-review (max 3 rounds)
- Hallucination critic on **every** task

### 36 Specialist Agents

```bash
bestwork agents    # full catalog
```

**18 Tech**: backend, frontend, fullstack, infra, database, API, mobile, testing, security, performance, devops, data, ML, CLI, realtime, auth, migration, config

**8 PM**: product, API, platform, data, infra, migration, security, growth

**10 Critic**: performance, scalability, security, consistency, reliability, testing, hallucination, DX, type safety, cost

Agent prompts live in `prompts/` — edit without rebuilding.

### Development Controls

```
./scope src/auth/       Lock edits to directory
./unlock                Remove lock
./strict                Block rm -rf, force read-before-edit
./relax                 Disable strict
./tdd add user auth     Test-driven development flow
./context [files]       Preload files into context
./recover               Reset approach when stuck
./review                Platform/runtime hallucination check
```

### Smart Gateway

No commands to memorize. Type naturally in any language:

```
"review my code for platform issues"     → ./review
"run these 3 tasks in parallel"          → ./trio
"why did that session fail"              → ./autopsy
"how can I prompt better"                → ./learn
```

### Anti-Hallucination (automatic)

- **Grounding** — warns when editing unread files
- **Validation** — TypeScript typecheck after every code change
- **Platform review** — detects OS/runtime mismatches on session end
- **Scope enforcement** — blocks edits outside locked path
- **Strict enforcement** — blocks destructive commands

### Notifications

```
./discord <webhook_url>
./slack <webhook_url>
```

Rich notifications on every prompt completion:
- Prompt summary + session stats
- Git diff (key files if >10 changed)
- Platform review result
- Session health (failure rate, loop detection)
- Trio report: iterations, critic fixes, PM decisions
- Color-coded: green / yellow / red

---

## Observability

```bash
bestwork                  # TUI dashboard
bestwork sessions         # List with CWD, last prompt, usage %
bestwork session <id>     # Tool breakdown, agent tree
bestwork summary -w       # Weekly overview
bestwork live             # Real-time monitoring
bestwork heatmap          # 365-day activity grid
bestwork loops            # Agent loop detection
bestwork replay <id>      # Step-by-step playback
bestwork effectiveness    # Prompt efficiency trend
bestwork outcome <id>     # Productivity verdict
bestwork watch            # Watch → notify on completion
bestwork export -f csv    # Export data
```

### Data-Driven Agents

```
./autopsy [id]         Session post-mortem
./learn                Prompting rules from history
./predict <task>       Complexity estimate
./guard                Session health check
./compare <id1> <id2>  Side-by-side comparison
```

---

## Architecture

```
bestwork/
├── src/
│   ├── cli/commands/
│   │   ├── observe/         12 observability commands
│   │   ├── harness/         install, watch, agents
│   │   └── notify/          notification config
│   ├── observe/             analytics engine
│   ├── harness/
│   │   ├── agents/
│   │   │   ├── tech/        18 individual agent files
│   │   │   ├── pm/          8 individual agent files
│   │   │   └── critic/      10 individual agent files
│   │   ├── notify.ts
│   │   └── prompt-loader.ts
│   ├── data/                Claude Code parsers
│   ├── types/               shared types
│   ├── ui/                  Ink TUI components
│   └── utils/               formatting
├── hooks/                   Claude Code hook scripts
├── prompts/                 agent system prompts (editable .md)
│   ├── tech/                18 prompts
│   ├── pm/                  8 prompts
│   └── critic/              10 prompts
├── templates/               notification templates (Discord/Slack)
├── schemas/                 JSON schemas (config, events, profiles)
└── benchmarks/              agent performance benchmarks
```

Everything is local. No data leaves your machine.

## Security

See [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
