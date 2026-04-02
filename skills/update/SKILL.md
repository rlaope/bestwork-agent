---
description: Check for updates and upgrade bestwork-agent to the latest version
---

Check if a newer version of bestwork-agent is available and guide the upgrade.

Steps:
1. Read the current version from the plugin cache:
   ```bash
   cat ~/.claude/plugins/cache/bestwork-tools/bestwork-agent/*/package.json 2>/dev/null | jq -r '.version'
   ```

2. Check the latest version from GitHub:
   ```bash
   curl -s https://raw.githubusercontent.com/rlaope/bestwork-agent/main/package.json | jq -r '.version'
   ```

3. If newer version available:
   - Tell the user: "Update available: {current} → {latest}"
   - Run: `/plugin update bestwork-agent`
   - Then: `/reload-plugins`

4. If already on latest:
   - Tell the user: "Already on latest version ({version})"
