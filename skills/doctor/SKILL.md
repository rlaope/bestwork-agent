---
name: doctor
description: Diagnose install/deploy flow integrity — checks hooks, paths, versions, and plugin config for mismatches
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] running diagnostics...
```

Run ALL of the following checks. For each check, print PASS or FAIL with details.

## 1. Version consistency

Check that version is the same across all files:
```bash
echo "package.json: $(jq -r '.version' package.json 2>/dev/null)"
echo "plugin.json: $(jq -r '.version' .claude-plugin/plugin.json 2>/dev/null)"
echo "marketplace.json: $(jq -r '.plugins[0].version' .claude-plugin/marketplace.json 2>/dev/null)"
```
If any differ → FAIL with which files mismatch.

## 2. Hook path resolution

Test that hooks can be found from both install paths:
```bash
# npm global path
NPM_HOOKS="$(npm root -g 2>/dev/null)/bestwork-agent/hooks"
echo "npm global hooks: $([ -d "$NPM_HOOKS" ] && echo 'FOUND' || echo 'NOT FOUND')"

# plugin cache path
CACHE_HOOKS="$(ls -d ~/.claude/plugins/cache/bestwork-tools/bestwork-agent/*/hooks 2>/dev/null | sort -V | tail -1)"
echo "plugin cache hooks: $([ -d "$CACHE_HOOKS" ] && echo "FOUND ($CACHE_HOOKS)" || echo 'NOT FOUND')"

# marketplace path
MP_HOOKS="$(ls -d ~/.claude/plugins/marketplaces/bestwork-tools/hooks 2>/dev/null)"
echo "marketplace hooks: $([ -d "$MP_HOOKS" ] && echo 'FOUND' || echo 'NOT FOUND')"
```
At least one path must exist → otherwise FAIL.

## 3. Hook registration

Check settings.json for bestwork hooks:
```bash
jq '.hooks | to_entries[] | .key as $ev | .value[] | .hooks[]? | select(._bestwork_id != null or (.command // "" | contains("bestwork"))) | "\($ev): \(._bestwork_id // .command[:50])"' ~/.claude/settings.json 2>/dev/null
```
Count registered hooks. Expected: 11. If fewer → WARN with missing hooks.

## 4. Plugin manifest

Check `.claude-plugin/plugin.json` has required fields:
- `name` exists
- `skills` points to existing directory
- `hooks` points to existing file (`hooks/hooks.json`)

```bash
SKILLS_PATH=$(jq -r '.skills // empty' .claude-plugin/plugin.json 2>/dev/null)
HOOKS_PATH=$(jq -r '.hooks // empty' .claude-plugin/plugin.json 2>/dev/null)
echo "skills field: $([ -n "$SKILLS_PATH" ] && [ -d "$SKILLS_PATH" ] && echo 'OK' || echo 'MISSING/BROKEN')"
echo "hooks field: $([ -n "$HOOKS_PATH" ] && [ -f "$HOOKS_PATH" ] && echo 'OK' || echo 'MISSING/BROKEN')"
```

## 5. npm publish readiness

Check `package.json` has `files` field:
```bash
jq -r '.files // empty' package.json 2>/dev/null
```
If missing → WARN: "npm publish will include all files".

Check required dirs exist:
```bash
for dir in dist hooks skills .claude-plugin; do
  echo "$dir: $([ -d "$dir" ] && echo 'OK' || echo 'MISSING')"
done
```

## 6. Dead references

Scan hook scripts for references to files that don't exist:
```bash
grep -roh 'bestwork-[a-z-]*\.sh' hooks/*.sh 2>/dev/null | sort -u | while read f; do
  [ ! -f "hooks/$f" ] && echo "DEAD: $f referenced but not found"
done
```

## 7. hooks.json vs install.ts parity

Compare hook IDs registered by both paths:
- `hooks.json` hooks (for plugin installs)
- `install.ts` HOOKS_REGISTRY (for npm installs)

List any hooks that exist in one but not the other.

## 8. Build artifacts

Check dist/ is up to date:
```bash
SRC_NEWEST=$(find src -name '*.ts' -newer dist/index.js 2>/dev/null | head -5)
if [ -n "$SRC_NEWEST" ]; then
  echo "STALE: dist/ is older than these source files:"
  echo "$SRC_NEWEST"
else
  echo "OK: dist/ is up to date"
fi
```

## Summary

Print a summary table:
```
[BW] diagnostics complete
  versions:    {PASS|FAIL}
  hook paths:  {PASS|FAIL}
  hooks reg:   {PASS|WARN} ({N}/11)
  plugin.json: {PASS|FAIL}
  npm ready:   {PASS|WARN}
  dead refs:   {PASS|FAIL}
  hook parity: {PASS|WARN}
  build:       {PASS|STALE}
```
