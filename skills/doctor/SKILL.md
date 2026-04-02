---
name: doctor
description: Diagnose the current project's deploy config vs actual code — find mismatches between what's configured and what exists
---

When this skill is invoked, IMMEDIATELY print:

```
[BW] running project diagnostics...
```

This skill checks the USER'S CURRENT PROJECT (the working directory), NOT bestwork-agent itself.
Detect which stack/platform the project uses, then run the relevant checks.

## 1. Detect Project Stack

```bash
ls -a package.json Cargo.toml go.mod pyproject.toml requirements.txt Gemfile pom.xml build.gradle Makefile 2>/dev/null
```

Identify: Node/Deno/Bun, Rust, Go, Python, Ruby, Java, or mixed. Also check for frameworks (Next.js, Nuxt, Django, Rails, etc.) by reading config files.

## 2. Package Dependencies vs Imports

For Node.js projects:
- Grep all `import ... from '...'` and `require('...')` in source files
- Compare against `dependencies` and `devDependencies` in `package.json`
- Report: packages imported but NOT in dependencies (phantom deps)
- Report: packages in dependencies but NEVER imported (dead deps)

For Python:
- Compare `import` statements against `requirements.txt` / `pyproject.toml`

For Go:
- Run `go mod tidy -diff` if available

## 3. Build Config vs Source

Check that build/bundle config references real files:
- **tsconfig.json**: `include`/`exclude` paths exist? `paths` aliases resolve?
- **tsup/vite/webpack config**: entry points exist?
- **Dockerfile**: `COPY` source paths exist? `CMD`/`ENTRYPOINT` binary exists in build output?
- **docker-compose.yml**: volume mounts, build contexts exist?

```bash
# Example for tsconfig
if [ -f tsconfig.json ]; then
  jq -r '.compilerOptions.paths // {} | to_entries[] | .value[]' tsconfig.json 2>/dev/null | while read p; do
    resolved="${p%/*}"
    [ ! -d "$resolved" ] && [ ! -f "${p%.ts}.ts" ] && echo "DEAD: tsconfig path alias → $p"
  done
fi
```

## 4. CI/CD Config vs Code

Check that CI/CD pipelines reference real scripts and files:
- **GitHub Actions** (`.github/workflows/*.yml`): `run:` commands reference existing scripts? Node version matches `engines`?
- **Vercel/Netlify config** (`vercel.json`, `netlify.toml`): build commands match `package.json` scripts?
- **Dockerfile**: base image Node version matches `engines`?

```bash
if ls .github/workflows/*.yml 1>/dev/null 2>&1; then
  grep -h 'node-version' .github/workflows/*.yml 2>/dev/null | grep -oP '\d+' | sort -u | while read ci_ver; do
    pkg_ver=$(jq -r '.engines.node // empty' package.json 2>/dev/null | grep -oP '\d+')
    [ -n "$pkg_ver" ] && [ "$ci_ver" != "$pkg_ver" ] && echo "MISMATCH: CI uses Node $ci_ver, package.json engines says $pkg_ver"
  done
fi
```

## 5. Environment Variables

- Scan source code for `process.env.XXX`, `os.environ`, `env::var` patterns
- Compare against:
  - `.env.example` / `.env.sample` (if exists)
  - CI/CD env declarations in workflow files
  - Docker env declarations
- Report: env vars used in code but not documented anywhere

```bash
grep -roh 'process\.env\.\w\+' src/ 2>/dev/null | sort -u | sed 's/process\.env\.//' | while read var; do
  found=0
  grep -q "$var" .env.example 2>/dev/null && found=1
  grep -q "$var" .env.sample 2>/dev/null && found=1
  grep -rq "$var" .github/workflows/ 2>/dev/null && found=1
  [ "$found" -eq 0 ] && echo "UNDOCUMENTED: $var used in code but not in .env.example or CI"
done
```

## 6. Deploy Config vs Code Structure

- **Serverless** (`serverless.yml`): handler paths point to real files?
- **K8s** (`k8s/*.yml`, `helm/`): image names, ports, volume paths valid?
- **Vercel**: `api/` directory exists if serverless functions configured?
- **package.json `scripts`**: referenced files exist? (`node scripts/foo.js` — does `scripts/foo.js` exist?)

```bash
jq -r '.scripts // {} | to_entries[] | .value' package.json 2>/dev/null | grep -oP '(?:node |ts-node |tsx )\K[^ ]+' | while read f; do
  [ ! -f "$f" ] && echo "DEAD: package.json script references $f but file not found"
done
```

## 7. Git Hooks vs Config

- If `.husky/` exists: do hook scripts reference valid commands?
- If `lint-staged` in package.json: do glob patterns match existing files?
- If `commitlint`: is config present?

## 8. Platform Mismatches

- Check for OS-specific code on wrong platform:
  - Linux patterns (`/proc/`, `systemd`, `apt-get`) on macOS
  - macOS patterns (`launchd`, `NSApplication`) on Linux
  - Windows patterns (`HKEY_`, `C:\\`) on Unix
- Check runtime mismatches:
  - `Deno.*` APIs but no `deno.json`
  - `Bun.*` APIs but not running Bun
  - Node APIs in Deno/Bun project

## Summary

Print results as:
```
[BW] project diagnostics complete

  dependencies:  {PASS|WARN} ({N} phantom, {N} dead)
  build config:  {PASS|FAIL} ({details})
  CI/CD:         {PASS|WARN} ({details})
  env vars:      {PASS|WARN} ({N} undocumented)
  deploy config: {PASS|FAIL} ({details})
  git hooks:     {PASS|WARN}
  platform:      {PASS|WARN} ({details})

  {total issues found}
```

If critical issues found, suggest: `./plan fix deploy issues` to auto-fix.
