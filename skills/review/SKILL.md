---
description: Check code for platform/runtime mismatches and hallucinations
---

Run `./review` to scan your recent code changes for:
- Nonexistent imports (package not in dependencies)
- Missing file references (relative imports to nowhere)
- Linux-specific code on macOS (or vice versa)
- Wrong runtime APIs (Deno/Bun without the runtime installed)
- Deprecated Node.js patterns
- Suspicious AI-hallucinated method calls
- Type safety bypasses (as any, ts-ignore)

Also runs automatically on every session end via the Stop hook.
