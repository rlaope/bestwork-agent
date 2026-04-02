# Security Policy

## Data Privacy

bestwork-agent is a **local-only** tool. No data ever leaves your machine.

- All data is read from `~/.claude/` (Claude Code's local storage)
- Hook-captured events are stored in `~/.bestwork-agent/data/` on your local filesystem
- **Zero network requests** — bestwork-agent makes no HTTP calls, no telemetry, no analytics
- No data is sent to any server, API, or third party

## What bestwork-agent reads

| Source | What | Why |
|--------|------|-----|
| `~/.claude/.session-stats.json` | Tool call counts | Session analytics |
| `~/.claude/history.jsonl` | Prompt text | Timeline & replay |
| `~/.claude/sessions/*.json` | Session metadata | Active session detection |
| `~/.claude/projects/*/subagents/*.meta.json` | Agent types | Agent tree visualization |

bestwork-agent **never** reads:
- API keys or credentials
- Environment variables
- Authentication tokens
- File contents that Claude Code edited

## Hooks Security

When you run `bestwork-agent install`, hooks are added to `~/.claude/settings.json`:
- Hooks only capture tool names, file paths, and timestamps
- File **contents** are never captured
- A backup of your settings is created before modification
- Hooks run with a 5-second timeout to prevent hanging
- Gateway hook runs with a 10-second timeout

## Dependency Policy

bestwork-agent uses minimal dependencies:
- `ink` + `react` — TUI rendering (well-audited, widely used)
- `commander` — CLI parsing
- `chokidar` — File watching
- `date-fns` — Date formatting

No dependencies that make network requests. No native modules.

## Reporting Vulnerabilities

If you find a security issue, please report it privately:
- Email: [create a GitHub security advisory](https://github.com/rlaope/bestwork-agent/security/advisories/new)
- Do **not** open a public issue for security vulnerabilities

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |
