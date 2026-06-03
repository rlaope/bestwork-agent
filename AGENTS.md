# bestwork-agent

Open-source harness engineering for Claude Code. 50 specialist agents (25 tech + 10 pm + 15 critic), 14 org roles, 22 skills.

## Build & Test

```bash
npm run build    # tsup + auto-sync to plugin paths
npm test         # vitest (689+ tests)
npx tsc --noEmit # typecheck
```

## Key Directories

- `src/harness/` — orchestrator, classifyIntent, org roles, smart-gateway
- `src/observe/` — session analytics, heatmap, loop detection, replay
- `hooks/` — Claude Code hooks (shell + agent type)
- `skills/` — 22 plugin slash commands
- `prompts/` — editable agent system prompts (50 .md files)

For architecture details, gateway flow, HUD caching, state paths, and install paths see [docs/architecture.md](docs/architecture.md).

## Agent Progress Tracking (CRITICAL)

When spawning background agents (trio, blitz, delegate, etc.), you MUST call TaskCreate for EACH agent so users see live progress spinners:
- Before spawning: `TaskCreate(subject="bestwork:{agent} (task N)", activeForm="bestwork:{agent} working...")`
- When done: `TaskUpdate(status="completed")`
- When failed: `TaskUpdate(status="completed")` + print `[BW] ✗`

## BW Output Rule (CRITICAL)

Every response MUST start with the `[BW]` tag from the gateway's additionalContext. If the gateway says `[BW] solo — bestwork:sr-backend`, print that EXACTLY as the first line. If no gateway context exists, print `[BW] no gateway`.

## Rules

- English only in source code. Korean allowed only in bilingual routing keywords.
- No Co-Authored-By in commits.
- No confirmation prompts — gateway decides scale, user confirms/adjusts dynamic plan.
- Shell hooks use jq for JSON (no string interpolation).
- Agent prompts live in prompts/*.md — editable without rebuild.
- SKILL_ROUTES patterns must require action verbs to prevent false positives.
- Meeting logs go to `.bestwork/state/` (project root), not `~/.bestwork/`.
- HUD must never refresh OAuth tokens. Read-only access only.
- Team structure descriptions are result-focused, not process-focused.
- `npm run build` auto-syncs to plugin cache + marketplace paths.
- Verifier (`critic-verifier`) must run in a separate pass from the author — never self-approve work produced in the same active context.
- Silent `catch {}` is banned in src/harness and src/observe. Use `logger.warn/error` from `src/harness/logger.ts` with scope + error.
