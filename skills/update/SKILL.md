---
name: update
description: Check for updates and upgrade bestwork-agent to the latest version
---

When this skill is invoked, IMMEDIATELY print this before doing anything:

```
[BW] checking for updates...
```

Steps:
1. Read the current installed commit hash and version:
   ```bash
   CACHE_DIR=$(ls -d ~/.claude/plugins/cache/bestwork-tools/bestwork-agent/*/ 2>/dev/null | sort -V | tail -1)
   CURRENT_VERSION=$(jq -r '.version' "${CACHE_DIR}package.json" 2>/dev/null || echo "unknown")
   CURRENT_HASH=$(git -C "$CACHE_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
   echo "installed: v${CURRENT_VERSION} (${CURRENT_HASH})"
   ```

2. Check the latest commit hash from GitHub:
   ```bash
   LATEST_HASH=$(curl -s https://api.github.com/repos/rlaope/bestwork-agent/commits/main 2>/dev/null | jq -r '.sha[:7]' 2>/dev/null || echo "unknown")
   LATEST_VERSION=$(curl -s https://raw.githubusercontent.com/rlaope/bestwork-agent/main/package.json 2>/dev/null | jq -r '.version' 2>/dev/null || echo "unknown")
   echo "latest: v${LATEST_VERSION} (${LATEST_HASH})"
   ```

3. If hashes differ (newer commits available), print:
   ```
   [BW] update available: v{current_version} ({current_hash}) → v{latest_version} ({latest_hash})
   [BW] upgrading...
   ```
   Then run:
   ```bash
   claude plugin update bestwork-agent@bestwork-tools
   ```
   After done, print:
   ```
   [BW] done! you're on v{latest_version} ({latest_hash}) now. restart session to apply.
   ```

4. If hashes are the same, print:
   ```
   [BW] you're already on the latest (v{version}, {hash}). no action needed.
   ```
