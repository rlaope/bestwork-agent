---
name: status
description: Show current bestwork-agent configuration
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] checking status...
```

Show:
- Scope lock (active path or "none")
- Strict mode (on/off)
- Notifications (Discord/Slack configured or not — read ~/.bestwork/config.json)
- Hooks count (how many bestwork hooks in settings.json)
- CLI version (`bestwork --version`)

After done, print:
```
[BW] status complete. bestwork v{version} operational.
```
