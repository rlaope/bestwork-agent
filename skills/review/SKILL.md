---
description: Check code for hallucinations and platform mismatches
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] scanning for hallucinations...
```

Run the review:
1. Check `git diff` (unstaged → staged → last commit) for:
   - Nonexistent imports (package not in dependencies)
   - Missing file references (relative imports to nowhere)
   - Platform-specific code on wrong OS
   - Wrong runtime APIs (Deno/Bun without the runtime)
   - Deprecated Node.js patterns
   - Suspicious AI-hallucinated method calls
   - Type safety bypasses (as any, ts-ignore)

2. Run `bash "${CLAUDE_PLUGIN_ROOT}/hooks/bestwork-review.sh"` or check manually.

After done, print:
```
[BW] review complete. {N} issues found.
```
or:
```
[BW] review complete. all clear — no hallucinations detected.
```
