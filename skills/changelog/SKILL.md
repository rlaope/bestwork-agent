---
description: Auto-generate changelog from git history
---

Auto-generate a changelog from git history:

1. Read `git log` since the last tag (or since a given ref)
2. Group commits by conventional commit type: `feat`, `fix`, `perf`, `refactor`, `docs`, `chore`, `test`
3. Output a formatted changelog section with version header, date, and grouped entries

Follows the [Keep a Changelog](https://keepachangelog.com) format. Works best with conventional commit messages (`feat:`, `fix:`, etc.).
