---
name: update
description: Check for updates and upgrade bestwork-agent — plugin cache + hooks + HUD all at once
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] checking for updates...
```

## Step 1: Compare versions

```bash
CACHE_DIR=$(ls -d ~/.claude/plugins/cache/bestwork-tools/bestwork-agent/*/ 2>/dev/null | sort -V | tail -1)
CURRENT_VERSION=$(jq -r '.version' "${CACHE_DIR}package.json" 2>/dev/null || echo "unknown")
CURRENT_HASH=$(git -C "$CACHE_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "installed: v${CURRENT_VERSION} (${CURRENT_HASH})"

LATEST_HASH=$(curl -s https://api.github.com/repos/rlaope/bestwork-agent/commits/main 2>/dev/null | jq -r '.sha[:7]' 2>/dev/null || echo "unknown")
LATEST_VERSION=$(curl -s https://raw.githubusercontent.com/rlaope/bestwork-agent/main/package.json 2>/dev/null | jq -r '.version' 2>/dev/null || echo "unknown")
echo "latest: v${LATEST_VERSION} (${LATEST_HASH})"
```

## Step 2: If different, upgrade everything

If hashes differ, print:
```
[BW] update available: v{current} ({hash}) → v{latest} ({hash})
[BW] upgrading...
```

Then run ALL of these in sequence:

```bash
# 1. Update plugin cache (git pull)
claude plugin update bestwork-agent@bestwork-tools
```

```bash
# 2. Re-register hooks (cleans up deprecated hooks from settings.json)
CACHE_DIR=$(ls -d ~/.claude/plugins/cache/bestwork-tools/bestwork-agent/*/ 2>/dev/null | sort -V | tail -1)
node "${CACHE_DIR}dist/index.js" install
```

```bash
# 3. Copy latest HUD script
CACHE_DIR=$(ls -d ~/.claude/plugins/cache/bestwork-tools/bestwork-agent/*/ 2>/dev/null | sort -V | tail -1)
cp "${CACHE_DIR}hooks/bestwork-hud.mjs" ~/.bestwork/hud.mjs 2>/dev/null
```

After all done, print:
```
[BW] done! v{latest} ({hash})
  ✓ plugin cache updated
  ✓ hooks re-registered
  ✓ HUD synced
  restart session to apply.
```

## Step 3: If same, no action

```
[BW] you're already on the latest (v{version}, {hash}). no action needed.
```
