---
name: docs
description: Sync all documentation (README, docs/, CLAUDE.md) with current codebase state
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] syncing docs with codebase...
```

## What this skill does

Audits and updates ALL project documentation to match the current code. This is NOT a simple copy — it reads the actual codebase to generate accurate docs.

## Steps

### 1. Gather current state

Read these files to understand what exists NOW:
- `package.json` — version, scripts, dependencies, bin
- `.claude-plugin/plugin.json` — plugin name, version
- `skills/*/SKILL.md` — all skill names + descriptions
- `prompts/tech/*.md`, `prompts/pm/*.md`, `prompts/critic/*.md` — count agents per role
- `src/harness/orchestrator.ts` — team modes, domain keywords, classification logic
- `src/harness/smart-gateway.ts` — skill routes, gateway flow
- `hooks/hooks.json` — registered hooks
- `hooks/*.sh`, `hooks/*.mjs` — hook scripts that exist
- `.github/workflows/*.yml` — CI/CD setup
- `CLAUDE.md` — current project instructions

Run:
```bash
npm test 2>&1 | tail -3   # get test count
ls skills/                  # get skill list
ls prompts/tech/ prompts/pm/ prompts/critic/ | wc -l  # get agent count
```

### 2. Update README.md

Read current `README.md`, then update with accurate numbers and features:
- Agent count (tech + pm + critic)
- Skill count and list
- Team mode descriptions (from orchestrator.ts)
- Install instructions (both npm and plugin paths)
- Available commands (from gateway SLASH_PREFIXES + skill names)
- Observability commands (from CLI)
- Current version

Keep the existing README structure and style. Only update facts that changed. Do NOT rewrite from scratch — preserve the tone and formatting.

### 3. Update README.ko.md and README.ja.md

Same updates as README.md but in Korean/Japanese respectively. If these files exist, update them. If not, skip.

### 4. Update docs/plugin-install.md

Read current file, then update:
- Correct plugin name format (`bestwork-agent@bestwork-tools`)
- Both install paths (npm + plugin marketplace)
- Update command (`/bestwork-agent:update` or `claude plugin update bestwork-agent@bestwork-tools`)
- Hook count
- Skill count

### 5. Update docs/skills-guide.md

Read current file, then regenerate the skill catalog from the actual `skills/*/SKILL.md` files. For each skill, extract name and description from frontmatter.

### 6. Update CLAUDE.md

Read current file. Update:
- Test count (from npm test output)
- Agent count
- Skill count and list
- Any architecture changes since last update
- Key directories if new ones were added

### 7. Verify accuracy

After all updates, run these checks:

**7a. Version numbers** — no stale version references:
```bash
grep -c "0.10.0\|0.9.0\|0.8.0" README.md README.ko.md README.ja.md docs/*.md CLAUDE.md 2>/dev/null
```
If any old version numbers found, fix them.

**7b. Agent counts** — every file must match actual prompt counts:
```bash
ls prompts/tech/ | wc -l   # tech count
ls prompts/pm/ | wc -l     # pm count
ls prompts/critic/ | wc -l # critic count
```
Search all docs for stale agent counts (36, 38, or any number that doesn't match the sum above). Fix them.

**7c. Command references** — every `./command` mentioned in docs must exist:
Check each `./command` reference against:
- `SLASH_PREFIXES` in `src/harness/smart-gateway.ts`
- skill directories in `skills/`
- hook scripts in `hooks/`
Remove or correct any references to commands that don't exist (e.g. `./team`, `./squad`).

**7d. Feature descriptions vs code** — spot-check key claims:
- Team modes described in README must match `TEAM_PRESETS` in `src/harness/org.ts`
- Gateway flow descriptions must match the actual tiers in `smart-gateway.ts`
- Install instructions must match actual install paths in `hooks/` and `package.json`
- Org role counts and level names must match `ALL_ORG_ROLES` in `org.ts`

**7e. Test count** — must match actual:
```bash
npm test 2>&1 | tail -3
```
Update any stale test count references in CLAUDE.md.

### 8. Summary

Print:
```
[BW] docs sync complete
  README.md:          {updated|no changes}
  README.ko.md:       {updated|no changes}
  README.ja.md:       {updated|no changes}
  docs/plugin-install: {updated|no changes}
  docs/skills-guide:   {updated|no changes}
  CLAUDE.md:           {updated|no changes}
  
  old version refs:    {count} found and fixed
```
