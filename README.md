# nysm

**now you see me** — Claude Code agent observability & session analytics in your terminal.

<p align="center">
  <img src="https://img.shields.io/npm/v/nysm?color=cyan" alt="npm version" />
  <img src="https://img.shields.io/github/license/rlaope/nysm" alt="license" />
  <img src="https://img.shields.io/github/stars/rlaope/nysm?style=social" alt="stars" />
</p>

---

Your Claude Code sessions are a black box. You don't know which tools ate the most calls, whether your agent is stuck in a loop, or what actually happened in that 30-minute session.

**nysm** cracks it open. Zero config, zero external infra — just a TUI that reads your local `~/.claude/` data and shows you everything.

```
  nysm — now you see me

  Sessions (8 total)

  #  ID          Started              Calls     Last Tool       Status
  ▸ 1 b322dc3e   16 minutes ago       110       Bash            ● live
    2 82ab7282   about 24 hours ago   244       Bash            ● live
    3 f64adc23   1 day ago            21        Bash            ○ done
    4 881cf851   1 day ago            304       Read            ○ done

  ↑↓ navigate • Enter select • q quit
```

## Install

```bash
npm install -g nysm
```

Requires Node.js 18+.

### Enable advanced features

```bash
nysm install
```

This registers Claude Code hooks for session replay, loop detection, and the natural language gateway. Data is stored locally in `~/.nysm/data/`.

## Usage

```bash
# Interactive TUI dashboard
nysm

# List recent sessions
nysm sessions

# Session detail with tool usage breakdown
nysm session <id>

# Today's summary
nysm summary

# Weekly overview
nysm summary -w

# Live monitoring (auto-refresh)
nysm live

# GitHub-style activity heatmap
nysm heatmap

# Detect agent loops and circular patterns
nysm loops

# Replay a session step-by-step
nysm replay <id>
```

## Features

### Session Dashboard
All your Claude Code sessions at a glance — sorted by recency, with call counts and active status. Arrow keys to navigate, Enter to drill in.

### Session Detail
Drill into any session:
- **Tool usage bar chart** — see which tools dominate (Read, Bash, Edit, Write...)
- **Subagent tree** — visualize agent delegation chains
- **Prompt history** — your recent inputs to the session

### Loop Detection
Catches your agent going in circles. Detects repeated tool calls on the same files within a time window.

```
  Loop Detection — 2 pattern(s) found

  ⚠  b322dc3e  Edit → /src/auth.ts  6x in 180s
  ⚠  b322dc3e  Bash → npm test      5x in 120s
```

Works in two modes:
- **Hooks mode** (after `nysm install`) — precise, per-event detection with sliding window
- **Heuristic mode** (no hooks needed) — flags sessions where a single tool dominates >60% of calls

### Session Replay
Step-by-step playback of what your agent actually did:

```
  Session Replay — b322dc3e
  47 steps

  Tool Summary
  ⚡ Bash             ████████████   15
  📖 Read             ████████░░░░   10
  🔧 Edit             ██████░░░░░░    8

  Timeline
  ──────────────────────────────────────────────
     1  04/01 22:50         📖 Read           src/auth.ts
     2  04/01 22:50  +1.2s  🔧 Edit           src/auth.ts
     3  04/01 22:51  +4.5s  ⚡ Bash           npm test
     4  04/01 22:51  +2.1s  📖 Read           test output
     5  04/01 22:51  +0.8s  🔧 Edit           src/auth.ts
```

### Activity Heatmap
GitHub-style contribution graph for your AI coding sessions:

```
  nysm — Activity Heatmap

  Mon  ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ▒ ░ ░ ░ ▓ ░ ░ ░ █
  Wed  ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ▓
  Fri  ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░

  8 sessions · 4 active days · 2 day streak
  ░ none  ▒ low  ▓ med  █ high
```

### Natural Language Gateway
After `nysm install`, use natural language in Claude Code:

- "루프 감지해줘" / "detect loops" → runs loop detection
- "히트맵 보여줘" / "show heatmap" → shows activity heatmap
- "세션 요약" / "session summary" → shows today's stats
- "주간 리포트" / "weekly report" → shows weekly summary

### Daily / Weekly Summary
```
  nysm — Weekly Summary

  Date          Sessions    Calls     Top Tool
  ──────────────────────────────────────────────────
  2026-03-28    3           473       Bash
  2026-03-29    1           128       Read
  2026-03-31    3           569       Bash
  2026-04-01    1           109       Bash
  ──────────────────────────────────────────────────
  Total         8           1,279
```

## How it works

nysm reads data that Claude Code already stores locally:

| Source | Data |
|--------|------|
| `~/.claude/.session-stats.json` | Tool call counts per session |
| `~/.claude/history.jsonl` | Prompt history with timestamps |
| `~/.claude/sessions/*.json` | Active session metadata (PID, CWD) |
| `~/.claude/projects/*/subagents/*.meta.json` | Agent delegation tree |

With hooks enabled (`nysm install`), additional per-event data is captured to `~/.nysm/data/`.

No API keys needed. No data leaves your machine. Everything is local.

## Security

- **Zero network requests** — nysm makes no HTTP calls, no telemetry, no analytics
- **Local-only storage** — all data stays in `~/.claude/` and `~/.nysm/`
- **No file contents captured** — hooks only record tool names, file paths, and timestamps
- **Minimal dependencies** — no native modules, no network-capable packages
- **Settings backup** — `nysm install` preserves your existing Claude Code config

See [SECURITY.md](SECURITY.md) for details.

## Roadmap

- [x] Session dashboard & detail view
- [x] Daily / weekly summaries
- [x] Live monitoring mode
- [x] Loop detection
- [x] Session replay
- [x] Activity heatmap
- [x] Natural language gateway
- [ ] Prompt effectiveness scoring
- [ ] Session outcome tracking (files changed, tests passed)
- [ ] Export (JSON/CSV, shareable summary cards)
- [ ] Cross-tool support (Cursor, Windsurf, Copilot)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome.

## License

[MIT](LICENSE)
