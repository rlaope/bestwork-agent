---
description: Quick session health check
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] running health check...
```

Check:
- **Outcome**: Run `bestwork outcome` on current session
- **Efficiency**: Show calls/prompt ratio
- **Loop detection**: Flag repeated tool calls
- **Platform review**: Check for OS/runtime mismatches

After done, print one of:
```
[BW] health check: all green. session is productive.
```
or:
```
[BW] health check: {N} issue(s) found. see above.
```
