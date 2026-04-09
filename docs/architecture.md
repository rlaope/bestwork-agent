# Architecture

## Tech Stack

- TypeScript, Node.js 18+, ESM
- Ink (React for CLI) — TUI components
- tsup — bundler
- vitest — testing
- commander — CLI parser

## User Perspective

- **Every prompt goes through the gateway**. The gateway classifies intent → dynamically allocates tasks+agents → shows `[BW]` tag.
- **Non-solo tasks show a dynamic plan** (task breakdown + agents per task) via AskUserQuestion. User confirms, adjusts, or drops to solo.
- **`.bestwork/` in project root** is auto-created on first hook run. Contains: `state/`, `plans/`, `logs/`, `sessions/`, `notepad/`.
- **`~/.bestwork/`** is global: usage cache, HUD script, config.
- **Skills** are invoked via `/bestwork-agent:skillname` or natural language.

## Gateway Flow (every prompt)

1. `hooks.json` → `dist/smart-gateway.js` runs on UserPromptSubmit
2. Tier 0: `./command` slash prefixes → passthrough to shell handler
3. Tier 1: SKILL_ROUTES regex matching (action-verb required to avoid false positives)
4. Tier 2: `classifyIntent()` → dynamic task+agent allocation
   - Splits prompt into 1-5 tasks, assigns 1-5 agents per task based on need
   - Each task gets only the agents it needs: tech-only, tech+critic, tech+pm+critic, etc.
   - Returns `taskAllocations[]` with per-task agent lists + `totalAgents` count
   - `mode` field preserved for backward compat (solo/pair/trio/squad/hierarchy)
5. Solo → `[BW] solo — bestwork:agent` + proceed
6. Non-solo → AskUserQuestion showing task breakdown + agents, user confirms/adjusts/goes solo

## Two Install Paths

- **npm global**: `npm install -g bestwork-agent && bestwork install`
  - Hooks use `$(npm root -g)/bestwork-agent/hooks/` with plugin cache fallback
- **Claude Code plugin**: `/plugin marketplace add https://github.com/rlaope/bestwork-agent`
  - Hooks use `${CLAUDE_PLUGIN_ROOT}/hooks/` via hooks.json

## HUD Caching (bestwork-hud.mjs)

- 90s poll interval between successful API calls
- 429: exponential backoff (90s → 180s → 360s → 5min cap)
- Stale data: always show cached data over `--`
- File locking: `.usage-cache.lock` prevents concurrent API calls
- OAuth token: READ ONLY. Never refresh. Never invalidate Claude Code's token.

## State Paths

### Project State (.bestwork/ in project root)
- `state/meeting.jsonl` — trio/squad/hierarchy meeting logs
- `plans/` — saved execution plans (JSON + MD)
- `logs/`, `sessions/`, `notepad/` — project-local working state

### Global State (~/.bestwork/)
- `.usage-cache.json` — HUD API cache
- `hud.mjs` — copied HUD script for statusLine
- `config.json` — discord/slack webhook config
- `data/` — session event logs

## Reference Codebases

Cloned at the same level for pattern reference only. Do NOT copy code.

- **oh-my-claudecode (OMC)**: `/Users/rlaope/Desktop/khope/oh-my-claudecode/`
  - Best reference for: plugin manifest, skill structure, HUD caching strategy, hook patterns
- **oh-my-openagent (OMO)**: `/Users/rlaope/Desktop/khope/oh-my-openagent/`
  - Best reference for: agent SDK design, monorepo patterns
