---
name: update
description: Check for updates and upgrade bestwork-agent to the latest version
---

When this skill is invoked, IMMEDIATELY print this before doing anything:

```
[BW] checking for updates...
```

Steps:
1. Read the current version:
   ```bash
   cat ~/.claude/plugins/cache/bestwork-tools/bestwork-agent/*/package.json 2>/dev/null | jq -r '.version'
   ```

2. Check the latest version from GitHub:
   ```bash
   curl -s https://raw.githubusercontent.com/rlaope/bestwork-agent/main/package.json | jq -r '.version'
   ```

3. If newer version available, print:
   ```
   [BW] update available: {current} → {latest}
   [BW] upgrading... hang tight
   ```
   Then run `/plugin update bestwork-agent` and `/reload-plugins`.
   After done, print:
   ```
   [BW] done! you're on {latest} now. restart to apply.
   ```

4. If already on latest, print:
   ```
   [BW] you're already on the latest (v{version}). no action needed.
   ```
