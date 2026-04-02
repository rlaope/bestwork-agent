# bestwork-agent

## Project

Open-source harness engineering for Claude Code. Organizes AI agents into corporation-style teams (hierarchy/squad) with 38 specialist profiles and 14 org roles.

## Reference Codebases

These are cloned at the same level for code reference. Use them to understand patterns, not to copy code.

- **oh-my-claudecode (OMC)**: `/Users/rlaope/Desktop/khope/oh-my-claudecode/`
  - Plugin architecture: `.claude-plugin/`, `skills/`, `agents/`, `hooks/`
  - HUD/statusline: `dist/hud/`, `scripts/`
  - Team orchestration: `bridge/`, `missions/`
  - Best reference for: plugin manifest, skill structure, hook patterns, MCP bridge

- **oh-my-openagent (OMO)**: `/Users/rlaope/Desktop/khope/oh-my-openagent/`
  - Monorepo structure: `packages/`
  - Agent definitions: `AGENTS.md`
  - Best reference for: monorepo patterns, cross-tool support, agent SDK design

## Tech Stack

- TypeScript, Node.js 18+, ESM
- Ink (React for CLI) — TUI components
- tsup — bundler
- vitest — testing
- commander — CLI parser

## Key Directories

- `src/harness/` — agent profiles (38), org roles (14), orchestrator, meeting log
- `src/observe/` — session analytics, heatmap, loop detection, replay
- `hooks/` — Claude Code hooks (shell + agent type)
- `skills/` — plugin slash commands
- `prompts/` — editable agent system prompts (36 .md files)

## Build & Test

```bash
npm run build    # tsup
npm test         # vitest (93 tests)
npx tsc --noEmit # typecheck
```

## Architecture Lessons from OMC/OMO

Key patterns to adopt (NOT copy code — learn the approach):

### From OMC (oh-my-claudecode)
- **File-based team coordination**: No persistent server. Teams use `.omc/state/team/{name}/` with config.json, tasks/*.json, workers/*/heartbeat.json, workers/*/inbox.md. File locks prevent concurrent writes. Atomic writes (temp + rename).
- **HUD cache strategy**: 15s failure TTL, 2min transient TTL, 5min 429 backoff, 15min stale cutoff. Project-scoped state, not session-scoped.
- **Skill phases**: Multi-phase pipelines (Expansion → Planning → Execution → QA → Validation). Each phase checkpointed to disk. Phases skip when prior work exists.
- **Plugin manifest is sparse**: plugin.json only declares paths. Behavior lives in skill YAML frontmatter and hooks.json.
- **Hook runner**: `run.cjs` handles cross-platform (Windows, NVM, plugin versioning). Scripts communicate via stdin/stdout JSON.

### From OMO (oh-my-openagent)
- **Agent factory pattern**: Each agent exports metadata (category, cost, delegation triggers, use/avoid conditions). Orchestrator's prompt is dynamically populated from agent metadata.
- **Multi-level config merging**: Project/user/defaults recursively merged with schema validation.
- **Background task manager**: 5 concurrent per model, managed lifecycle.
- **48 lifecycle hooks**: Granular control beyond the standard 8 Claude Code events.

### What bestwork should NOT do
- Don't build a persistent server for team coordination (use files + locks like OMC)
- Don't hardcode agent prompts in gateway (load from prompts/*.md like we already do)
- Don't use string interpolation in shell hooks (use jq, already fixed)

## Rules

- English only in source code. Korean allowed only in bilingual routing keywords.
- No Co-Authored-By in commits.
- No confirmation prompts — just do it.
- Shell hooks use jq for JSON (no string interpolation).
- Agent prompts live in prompts/*.md — editable without rebuild.
