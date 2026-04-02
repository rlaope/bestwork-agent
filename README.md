# nysm

**now you see me** — open-source harness engineering for Claude Code.

<p align="center">
  <img src="https://img.shields.io/npm/v/nysm?color=cyan" alt="npm version" />
  <img src="https://img.shields.io/github/license/rlaope/nysm" alt="license" />
  <img src="https://img.shields.io/github/stars/rlaope/nysm?style=social" alt="stars" />
</p>

---

nysm makes your AI coding agent faster, safer, and smarter.

Two independent pillars:
- **Harness** — controls and accelerates your agent during development
- **Observability** — shows you what your agent actually did

## Install

```bash
npm install -g nysm
nysm install
```

Restart Claude Code after install. Type `./help` to see all commands.

---

## Harness

### Development Controls

```
./scope src/auth/          Lock edits to a directory
./unlock                   Remove scope lock
./strict                   Enable all guardrails (block rm -rf, force read-before-edit)
./relax                    Disable strict mode
./context                  Preload recently changed files into context
./context src/api.ts       Preload specific files
./tdd add user auth        Force test-driven development flow
./recover                  Agent stuck? Reset approach
```

### Platform Review

```
./review                   Check if code matches your actual OS/runtime
```

Detects: Linux code on macOS, Deno APIs without Deno, deprecated Node.js patterns, Windows registry on Unix, etc. Also auto-runs after each prompt completion.

### Parallel Trio Execution

```
./trio implement auth | add tests | update docs
```

Each task gets 3 agents:
- **Tech** — writes the code
- **PM** — verifies requirements are met
- **Critic** — checks quality, hallucination, platform match

Feedback loop: if PM or Critic rejects, Tech fixes and re-submits (max 3 rounds). If >30% of tasks needed fixes, triggers full session review.

### Notifications

```
./discord <webhook_url>    Get Discord alerts
./slack <webhook_url>      Get Slack alerts
```

Each notification includes:
- What prompt was entered (summary)
- Session stats (calls, prompts)
- Git changes (key files if >10 changed)
- Platform review result
- Session health (failure rate, loop detection)
- Color-coded: green (clean), yellow (warnings), red (issues)

### Anti-Hallucination (automatic)

These run silently after `nysm install`:

- **Grounding** — warns when editing a file not read in this session
- **Validation** — auto TypeScript typecheck after every code change
- **Scope enforcement** — blocks edits outside `./scope` path
- **Strict enforcement** — blocks `rm -rf`, `git push --force`, etc.
- **Platform review** — catches OS/runtime mismatches on Stop

### Smart Gateway

No need to memorize commands. Just type naturally:

| What you type | What runs |
|---------------|-----------|
| "코드 리뷰해줘" / "review my code" | `./review` |
| "병렬로 돌려줘" / "run in parallel" | `./trio` |
| "왜 실패했어" / "why did it fail" | `./autopsy` |
| "프롬프트 개선법" / "improve prompts" | `./learn` |
| "루프 감지" / "detect loops" | loop detection |

### Data-Driven Agents

These use your session history — the more you use nysm, the smarter they get.

```
./autopsy [session_id]     Why did that session struggle?
./similar [query]          Find past sessions with similar patterns
./learn                    Extract prompting rules from your history
./predict <task>           Estimate task complexity
./guard                    Is this session on track?
./compare <id1> <id2>      Compare two sessions
```

---

## Observability

### CLI

```bash
nysm                  # Interactive TUI dashboard
nysm sessions         # Session list (CWD, last prompt, usage %)
nysm session <id>     # Tool breakdown, agent tree, prompts
nysm summary -w       # Weekly overview
nysm live             # Real-time monitoring
```

### Analytics

```bash
nysm heatmap          # 365-day activity grid
nysm loops            # Agent loop detection
nysm replay <id>      # Step-by-step session playback
nysm effectiveness    # Prompt efficiency trend
nysm outcome <id>     # Productivity verdict
nysm card             # Shareable stats card
nysm export -f csv    # Export data
nysm watch            # Watch sessions → notify on completion
```

---

## How it works

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| Harness | `UserPromptSubmit` — smart gateway | Slash commands, natural language routing |
| Harness | `PreToolUse` — enforcement hooks | Grounding, scope lock, strict mode |
| Harness | `PostToolUse` — validation hooks | Auto typecheck, event capture |
| Harness | `Stop` — completion hooks | Rich notifications, auto platform review |
| Observability | `~/.claude/` parsing | Session stats, history, agent tree |
| Observability | `~/.nysm/data/` JSONL | Tool call sequences |

Everything is local. No data leaves your machine.

## Security

See [SECURITY.md](SECURITY.md).

## Roadmap

- [x] Harness — scope, strict, TDD, parallel, recover
- [x] Trio execution — Tech + PM + Critic per task
- [x] Platform review — OS/runtime hallucination detection
- [x] Smart gateway — natural language → agent routing
- [x] Rich notifications — Discord/Slack with full context
- [x] Anti-hallucination — grounding, validation, review
- [x] Observability — sessions, heatmap, replay, loops
- [ ] Auto-stop on loop detection
- [ ] Smart model routing (Haiku/Sonnet/Opus)
- [ ] Cost tracking with budget enforcement
- [ ] Cross-tool support (Cursor, Windsurf)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
