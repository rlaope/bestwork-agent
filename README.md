# bestwork-agent

Best harness engineering for Claude Code. Work like a corporation team, not just a club.

<p align="center">
  <img src="https://img.shields.io/npm/v/bestwork-agent?color=cyan" alt="npm version" />
  <img src="https://img.shields.io/github/license/rlaope/bestwork-agent" alt="license" />
  <img src="https://img.shields.io/github/stars/rlaope/bestwork-agent?style=social" alt="stars" />
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
</p>

---

## What is bestwork-agent?

Your AI agent works alone — it hallucinates, loops, misses requirements, and you find out too late.

**bestwork-agent** organizes your AI agent the way top unicorn companies organize their engineering teams. It analyzes your request, decides whether it needs a **hierarchical team** (waterfall, top-down authority) or a **squad** (agile, flat, fast) — and dispatches the right specialists automatically.

```
You: "Refactor the auth module to support OAuth2"

bestwork analyzes → large scope, architecture decision, security-sensitive
bestwork selects → Hierarchy: Security Team

┌─────────────────────────────────────────────────────┐
│  CISO                                               │
│  "Attack surface acceptable. Approve with           │
│   condition: rotate existing JWT secrets on deploy." │
│          ▲ final decision                           │
│  Tech Lead                                          │
│  "OAuth2 PKCE flow is correct. Consolidate the      │
│   two token refresh paths into one."                │
│          ▲ architecture review                      │
│  Sr. Security Engineer                              │
│  "Implementation secure. Added CSRF protection.     │
│   Input validation on redirect_uri."                │
│          ▲ implementation + hardening               │
│  Jr. QA Engineer                                    │
│  "Found: /callback doesn't handle expired state     │
│   param. Added test for token replay attack."       │
│          ▲ fresh eyes + edge cases                  │
└─────────────────────────────────────────────────────┘
```

```
You: "Add a dark mode toggle to the settings page"

bestwork analyzes → single feature, localized scope, fast feedback needed
bestwork selects → Squad: Feature Squad

┌──────────────────────────────────────────────────────┐
│                  Feature Squad (parallel)             │
│                                                      │
│  Sr. Backend         Sr. Frontend       Product Lead │
│  "API endpoint       "Toggle component  "Matches     │
│   for user prefs     with CSS vars,     user story.  │
│   ready. Tests        accessible."      Ship it."    │
│   passing."                                          │
│                         QA Lead                      │
│                    "Tested light/dark                 │
│                     + system pref.                    │
│                     All green."                       │
│                                                      │
│  Verdict: all APPROVE → merged                       │
└──────────────────────────────────────────────────────┘
```

```
You: "Why did my last session struggle?"

bestwork analyzes → observability request, not coding
bestwork selects → data analysis

  Session Outcome — b322dc3e  ✗ struggling

  Duration:     45m
  Calls/Prompt: 38 (high — avg is 12)
  Loop detected: Edit → Bash(test fail) → Edit × 6 on auth.ts

  Root cause: missing import caused test failure loop.
  Recommendation: use ./strict to force read-before-edit.
```

## How it works

bestwork-agent mirrors how the best engineering organizations operate:

**Hierarchy mode** — for decisions that need authority levels
```
CTO → Tech Lead → Sr. Engineer → Jr. Engineer
```
Junior implements first (fresh perspective catches obvious issues), seniors refine, leads review architecture, C-level makes final strategic calls. Each level can send work back down.

**Squad mode** — for tasks that need speed and collaboration
```
Backend + Frontend + Product + QA (all equal)
```
Everyone works in parallel. No single authority. Consensus-driven. Fast.

**The router picks automatically** based on task signals:
- Large scope / cross-directory / architecture → hierarchy
- Single feature / bugfix / localized → squad
- Security-sensitive files → security team
- Infra / CI/CD files → infra squad

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

### Option 3: Inside Claude Code

```
./bw-install
./bw-install --discord <webhook_url> --lang ko
./bw-install --strict
```

### Notifications

Connect your team's channel to receive rich alerts after every prompt:

| Platform | Command |
|----------|---------|
| Discord | `./discord <webhook_url> --lang ko` |
| Slack | `./slack <webhook_url> --lang en` |
| Telegram | `bestwork notify setup --telegram-token <token> --telegram-chat <id>` |

Supported languages: `en` (default), `ko`, `ja`

Each notification includes: team composition, agent decisions, code snippets, git diff, platform review, and session health — color-coded green/yellow/red.

### Verify

```bash
bestwork doctor    # check installation health
bestwork update    # check for updates
```

---

## Organization Chart

```bash
bestwork org    # full org chart
```

### 14 Roles × 4 Levels

| Level | Roles | Perspective |
|-------|-------|-------------|
| C-Level | CTO, CPO, CISO | Strategic — architecture, product direction, security posture |
| Lead | Tech Lead, EM, QA Lead, Product Lead | Tactical — code quality, delivery, test strategy, requirements |
| Senior | Backend, Frontend, Fullstack, Infra, Security | Deep implementation with mentoring |
| Junior | Engineer, QA | Fresh eyes — questioning assumptions, finding edge cases |

### 8 Team Presets

| Mode | Team | Composition |
|------|------|-------------|
| Hierarchy | Full Team | CTO → Tech Lead → Sr. Fullstack → Jr. Engineer |
| Hierarchy | Backend Team | CTO → Tech Lead → Sr. Backend → Jr. Engineer |
| Hierarchy | Frontend Team | CPO → Product Lead → Sr. Frontend → Jr. Engineer |
| Hierarchy | Security Team | CISO → Tech Lead → Sr. Security → Jr. QA |
| Squad | Feature Squad | Sr. Backend + Sr. Frontend + Product Lead + QA Lead |
| Squad | Infra Squad | Sr. Infra + Sr. Security + Tech Lead |
| Review | Code Review Board | Tech Lead + Sr. Security + QA Lead (2/3 approval) |
| Advisory | Architecture Review | CTO + Tech Lead + EM (direction only, no code) |

### Commands

```
./team Full Team refactor auth module       # hierarchy execution
./squad Feature Squad add dark mode         # squad execution
```

Or just describe what you need — the smart gateway routes it automatically.

---

## Domain Specialists

On top of the org structure, **36 domain-specific agents** provide deep expertise:

```bash
bestwork agents    # full catalog
```

**18 Tech**: backend, frontend, fullstack, infra, database, API, mobile, testing, security, performance, devops, data, ML, CLI, realtime, auth, migration, config

**8 PM**: product, API, platform, data, infra, migration, security, growth

**10 Critic**: performance, scalability, security, consistency, reliability, testing, hallucination, DX, type safety, cost

Agent prompts live in `prompts/` — edit without rebuilding.

---

## Harness Controls

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

### Anti-Hallucination (automatic)

- **Grounding** — warns when editing unread files
- **Validation** — TypeScript typecheck after every code change
- **Platform review** — detects OS/runtime mismatches (Linux code on macOS, etc.)
- **Scope enforcement** — blocks edits outside locked path
- **Strict enforcement** — blocks `rm -rf`, `git push --force`

### Notifications

```
./discord <webhook_url>
./slack <webhook_url>
```

Rich notifications per prompt: summary, git diff, platform review, session health. Color-coded green/yellow/red.

---

## Observability

```bash
bestwork                  # TUI dashboard
bestwork sessions         # Session list (CWD, last prompt, usage %)
bestwork session <id>     # Tool breakdown, agent tree
bestwork summary -w       # Weekly overview
bestwork heatmap          # 365-day activity grid
bestwork loops            # Agent loop detection
bestwork replay <id>      # Step-by-step session playback
bestwork effectiveness    # Prompt efficiency trend
bestwork outcome <id>     # Productivity verdict
bestwork export -f csv    # Export data
```

### Data-Driven Agents

```
./autopsy [id]         Session post-mortem — why did it struggle?
./learn                Extract prompting rules from your history
./predict <task>       Estimate complexity from past sessions
./guard                Current session health check
./compare <id1> <id2>  Side-by-side session comparison
```

---

## Security

Everything is local. No data leaves your machine. See [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
