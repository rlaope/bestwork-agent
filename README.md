# nysm

**now you see me** — Claude Code agent observability & session analytics in your terminal.

<p align="center">
  <img src="https://img.shields.io/npm/v/nysm?color=cyan" alt="npm version" />
  <img src="https://img.shields.io/github/license/rlaope/nysm" alt="license" />
  <img src="https://img.shields.io/github/stars/rlaope/nysm?style=social" alt="stars" />
</p>

---

Your Claude Code sessions are a black box. You don't know how many tokens you burned, which tools ate the most calls, or why that one session cost so much.

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
```

## What you get

### Session List
All your Claude Code sessions at a glance — sorted by recency, with call counts and active status.

### Session Detail
Drill into any session:
- **Tool usage bar chart** — see which tools dominate (Read, Bash, Edit, Write...)
- **Subagent tree** — visualize agent delegation chains
- **Prompt history** — your recent inputs to the session

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

### Live Mode
`nysm live` watches `~/.claude/` for changes and refreshes the dashboard in real time. See tool calls pile up as your agent works.

## How it works

nysm reads data that Claude Code already stores locally:

| Source | Data |
|--------|------|
| `~/.claude/.session-stats.json` | Tool call counts per session |
| `~/.claude/history.jsonl` | Prompt history with timestamps |
| `~/.claude/sessions/*.json` | Active session metadata (PID, CWD) |
| `~/.claude/projects/*/subagents/*.meta.json` | Agent delegation tree |

No API keys needed. No data leaves your machine. Everything is local.

## Roadmap

- [ ] **Hooks collector** — capture token usage, response sizes via Claude Code hooks
- [ ] **Cost estimation** — per-session and daily cost tracking with model pricing
- [ ] **Session replay** — step-by-step playback of agent decisions
- [ ] **Agent flamegraph** — visualize subagent execution time
- [ ] **Prompt effectiveness scoring** — measure which prompts work best
- [ ] **Export** — JSON/CSV export, shareable summary cards
- [ ] **Cross-tool support** — Cursor, Windsurf, Copilot analytics

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome.

## License

[MIT](LICENSE)
