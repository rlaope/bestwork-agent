---
description: Check code for platform/runtime mismatches and hallucinations
---

Run `./review` in Claude Code to scan your recent code changes for:
- Linux-specific code on macOS (or vice versa)
- Wrong runtime APIs (Deno/Bun without the runtime installed)
- Deprecated Node.js patterns
- Nonexistent imports

Also runs automatically on every session end via the Stop hook.
