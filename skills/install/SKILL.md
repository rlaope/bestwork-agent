---
name: install
description: Install bestwork hooks into Claude Code
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] installing hooks into Claude Code...
```

Try these in order until one succeeds:

1. `bestwork install` (npm global)
2. `node "$(npm root -g)/bestwork-agent/dist/index.js" install` (npm global via node)
3. `node "$(ls -d ~/.claude/plugins/cache/bestwork-tools/bestwork-agent/*/dist/index.js 2>/dev/null | tail -1)" install` (plugin cache)

If ALL fail, print:
```
[BW] install failed. Try: npm install -g bestwork-agent && bestwork install
```

After success, print:
```
[BW] installed. restart Claude Code to activate.
```
