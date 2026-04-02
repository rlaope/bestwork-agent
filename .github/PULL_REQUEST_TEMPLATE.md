## What

Brief description of the change.

## Why

What problem does this solve?

## How

Key implementation decisions.

## Test plan

- [ ] `npm run build` passes
- [ ] `npm test` passes (29+ tests)
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] Tested manually: `bestwork <command>`

## Checklist

- [ ] No hardcoded paths or secrets
- [ ] English only in source code (bilingual keywords in gateway prompts are OK)
- [ ] Agent prompts updated in both `src/harness/agents/` and `prompts/`
- [ ] Hook changes tested with Claude Code
