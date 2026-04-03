# bestwork-agent

## Project

Open-source harness engineering for Claude Code. Organizes AI agents into corporation-style teams (hierarchy/squad/trio) with 49 specialist agents (25 tech + 10 pm + 14 critic) and 14 org roles.

## User Perspective

Always think from the perspective of someone USING bestwork in their Claude Code session:

- **Every prompt goes through the gateway**. The gateway classifies intent → assigns mode (solo/pair/trio/squad/hierarchy) → shows `[BW]` tag.
- **Non-solo tasks present team structure options** via AskUserQuestion. User picks, then it executes. Descriptions are result-focused (what you get), not process-focused (how it works).
- **`.bestwork/` in project root** is auto-created on first hook run. Contains: `state/` (meeting logs), `plans/`, `logs/`, `sessions/`, `notepad/`.
- **`~/.bestwork/`** is global: usage cache, HUD script, config. Not project-specific.
- **Skills** are invoked via `/bestwork-agent:skillname` or natural language. Gateway routes automatically when action verbs are present (e.g. "리뷰 해줘" → review skill).

## Reference Codebases

Cloned at the same level for pattern reference only. Do NOT copy code.

- **oh-my-claudecode (OMC)**: `/Users/rlaope/Desktop/khope/oh-my-claudecode/`
  - Best reference for: plugin manifest, skill structure, HUD caching strategy, hook patterns
- **oh-my-openagent (OMO)**: `/Users/rlaope/Desktop/khope/oh-my-openagent/`
  - Best reference for: agent SDK design, monorepo patterns

## Tech Stack

- TypeScript, Node.js 18+, ESM
- Ink (React for CLI) — TUI components
- tsup — bundler
- vitest — testing (342 tests)
- commander — CLI parser

## Key Directories

- `src/harness/` — orchestrator, classifyIntent, org roles, meeting state
- `src/harness/smart-gateway.ts` — prompt classifier, skill router, team options
- `src/observe/` — session analytics, heatmap, loop detection, replay
- `hooks/` — Claude Code hooks (shell + agent type)
- `hooks/bestwork-hud.mjs` — HUD statusline (usage API with 90s poll, exponential backoff, file locking)
- `skills/` — 13 plugin slash commands (trio, plan, docs, doctor, review, update, etc.)
- `prompts/` — editable agent system prompts (49 .md files)
- `scripts/sync-plugin.mjs` — auto-syncs build to plugin cache/marketplace on `npm run build`

## Build & Test

```bash
npm run build    # tsup + auto-sync to plugin paths
npm test         # vitest (342 tests)
npx tsc --noEmit # typecheck
```

## Architecture

### Gateway Flow (every prompt)
1. `hooks.json` → `dist/smart-gateway.js` runs on UserPromptSubmit
2. Tier 0: `./command` slash prefixes → passthrough to shell handler
3. Tier 1: SKILL_ROUTES regex matching (action-verb required to avoid false positives)
4. Tier 2: `classifyIntent()` → solo/pair/trio/squad/hierarchy
5. Solo → `[BW] solo — bestwork:agent` + proceed
6. Non-solo → AskUserQuestion with 4 team options (result-based descriptions, language-aware)

### Two Install Paths
- **npm global**: `npm install -g bestwork-agent && bestwork install`
  - Hooks use `$(npm root -g)/bestwork-agent/hooks/` with plugin cache fallback
- **Claude Code plugin**: `/plugin marketplace add https://github.com/rlaope/bestwork-agent`
  - Hooks use `${CLAUDE_PLUGIN_ROOT}/hooks/` via hooks.json

### HUD Caching (bestwork-hud.mjs)
- 90s poll interval between successful API calls
- 429: exponential backoff (90s → 180s → 360s → 5min cap)
- Stale data: always show cached data over `--`
- File locking: `.usage-cache.lock` prevents concurrent API calls
- OAuth token: READ ONLY. Never refresh. Never invalidate Claude Code's token.

### Project State (.bestwork/ in project root)
- `state/meeting.jsonl` — trio/squad/hierarchy meeting logs
- `plans/` — saved execution plans (JSON + MD)
- `logs/`, `sessions/`, `notepad/` — project-local working state

### Global State (~/.bestwork/)
- `.usage-cache.json` — HUD API cache
- `hud.mjs` — copied HUD script for statusLine
- `config.json` — discord/slack webhook config
- `data/` — session event logs

## BW Output Rule (CRITICAL)

Every response MUST start with the `[BW]` tag from the gateway's additionalContext. If the gateway says `[BW] solo — bestwork:sr-backend`, print that EXACTLY as the first line. If no gateway context exists, print `[BW] no gateway`. This is non-negotiable.

## Rules

- English only in source code. Korean allowed only in bilingual routing keywords.
- No Co-Authored-By in commits.
- No confirmation prompts — gateway decides scale, user only picks team structure.
- Shell hooks use jq for JSON (no string interpolation).
- Agent prompts live in prompts/*.md — editable without rebuild.
- SKILL_ROUTES patterns must require action verbs to prevent false positives.
- Meeting logs go to `.bestwork/state/` (project root), not `~/.bestwork/`.
- HUD must never refresh OAuth tokens. Read-only access only.
- Team structure descriptions are result-focused, not process-focused.
- `npm run build` auto-syncs to plugin cache + marketplace paths.
