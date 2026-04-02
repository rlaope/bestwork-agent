---
description: Auto-generate changelog from git history
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] generating changelog...
```

1. Read `git log` since the last tag (or `--all` if no tags)
2. Group by conventional commit type: `feat`, `fix`, `perf`, `refactor`, `docs`, `chore`, `test`
3. Output formatted changelog

After done, print:
```
[BW] changelog generated. {N} entries since {tag/ref}.
```
