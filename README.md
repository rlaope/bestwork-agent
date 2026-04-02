# nysm

**now you see me** — open-source harness engineering for Claude Code.

<p align="center">
  <img src="https://img.shields.io/npm/v/nysm?color=cyan" alt="npm version" />
  <img src="https://img.shields.io/github/license/rlaope/nysm" alt="license" />
  <img src="https://img.shields.io/github/stars/rlaope/nysm?style=social" alt="stars" />
</p>

---

nysm is two things:

1. **Harness** — slash commands that make your AI agent faster, safer, and less error-prone
2. **Observability** — session analytics that show you what your agent actually did

Install once, get both. They work independently.

## Install

```bash
npm install -g nysm
nysm install
```

Restart Claude Code after install.

## Harness

Type these directly in Claude Code.

### Development Controls

| Command | What it does |
|---------|-------------|
| `./scope src/auth/` | Lock edits to a directory — agent can't modify files outside |
| `./unlock` | Remove scope lock |
| `./strict` | Enable all guardrails — block `rm -rf`, `git push --force`, force read-before-edit |
| `./relax` | Disable strict mode |
| `./context` | Preload recently changed files into agent context |
| `./context src/api.ts src/db.ts` | Preload specific files |
| `./tdd add user auth` | Force test-driven development flow |
| `./recover` | Agent stuck? Reset approach, try differently |
| `./parallel task1 \| task2` | Split into parallel agent execution |

### Notifications

| Command | What it does |
|---------|-------------|
| `./discord <webhook_url>` | Get Discord alerts after each prompt completes |
| `./slack <webhook_url>` | Get Slack alerts after each prompt completes |
| `./nysm` | Check nysm status |

Each notification includes: session ID, project name, git diff summary, timestamp.

### Data-Driven Agents

These agents use your session history to give personalized advice. The more you use nysm, the better they get.

| Command | What it does |
|---------|-------------|
| `./autopsy [session_id]` | Why did that session struggle? Deep post-mortem |
| `./similar [query]` | Find past sessions with similar patterns |
| `./learn` | Extract prompting rules from your productive sessions |
| `./predict <task>` | How complex will this task be? Based on your history |
| `./guard` | Is this session on track or drifting? |
| `./compare <id1> <id2>` | Compare two sessions side-by-side |

### Safety Hooks (automatic)

These run silently in the background after `nysm install`:

- **Grounding** — warns when the agent tries to edit a file it hasn't read yet (prevents hallucinated code)
- **Validation** — auto-runs TypeScript typecheck after every code change
- **Scope enforcement** — blocks edits outside `./scope` path
- **Strict enforcement** — blocks destructive commands in `./strict` mode

## Observability

### CLI Dashboard

```bash
nysm              # Interactive TUI
nysm sessions     # Session list with CWD, last prompt, usage %
nysm session <id> # Tool usage breakdown, subagent tree, prompts
nysm summary -w   # Weekly overview
nysm live         # Real-time monitoring
```

### Analytics

```bash
nysm heatmap        # GitHub-style 365-day activity grid
nysm loops          # Detect agent loop patterns
nysm replay <id>    # Step-by-step session playback
nysm effectiveness  # Prompt efficiency trend over 14 days
nysm outcome <id>   # Session productivity verdict
nysm card           # Shareable stats card
nysm export -f csv  # Export session data
```

### Watch Mode

```bash
nysm watch  # Select sessions → get notified when they complete
```

## How it works

nysm reads Claude Code's local data and hooks into its lifecycle:

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| Harness | `UserPromptSubmit` hooks | Slash commands, context injection |
| Harness | `PreToolUse` hooks | Grounding, scope lock, strict mode |
| Harness | `PostToolUse` hooks | Auto-validation, event capture |
| Harness | `Stop` hooks | Prompt completion notifications |
| Observability | `~/.claude/` file parsing | Session stats, history, agent tree |
| Observability | `~/.nysm/data/` JSONL | Detailed tool call sequences |

Everything is local. No data leaves your machine. No API keys needed.

## Security

- Zero network requests (except user-configured webhooks)
- No telemetry, no analytics
- Hooks only capture tool names and file paths, never file contents
- See [SECURITY.md](SECURITY.md)

## Roadmap

- [x] Harness — scope lock, strict mode, TDD, parallel, recover
- [x] Notifications — Discord, Slack, Telegram
- [x] Data-driven agents — autopsy, learn, predict, guard
- [x] Observability — sessions, heatmap, replay, loops, effectiveness
- [x] Anti-hallucination — grounding, auto-validation
- [ ] Auto-stop on loop detection
- [ ] Smart model routing (Haiku/Sonnet/Opus based on task)
- [ ] Session templates (reusable prompt patterns)
- [ ] Cost tracking with budget enforcement
- [ ] Cross-tool support (Cursor, Windsurf)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome.

## License

[MIT](LICENSE)
