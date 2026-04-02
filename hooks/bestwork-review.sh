#!/bin/bash
# bestwork review — hallucination detector (not just platform)
# Checks: fake imports, nonexistent files, wrong APIs, platform mismatch, deprecated patterns

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .display // ""' 2>/dev/null)

if ! echo "$PROMPT" | grep -qE '^\./review' && [ "$BESTWORK_REVIEW_TRIGGER" != "1" ]; then
  echo '{}'
  exit 0
fi

CACHE="$HOME/.bestwork/env-cache.json"
mkdir -p "$HOME/.bestwork"

# Env cache (1-hour TTL)
REBUILD=0
[ ! -f "$CACHE" ] && REBUILD=1
[ -f "$CACHE" ] && [ "$(find "$CACHE" -mmin +60 2>/dev/null)" ] && REBUILD=1

if [ "$REBUILD" = "1" ]; then
  jq -n \
    --arg os "$(uname -s)" \
    --arg arch "$(uname -m)" \
    --arg node "$(node -v 2>/dev/null || echo none)" \
    --arg bun "$(which bun >/dev/null 2>&1 && echo yes || echo no)" \
    --arg deno "$(which deno >/dev/null 2>&1 && echo yes || echo no)" \
    '{os:$os, arch:$arch, node:$node, bun:$bun, deno:$deno}' > "$CACHE"
fi

OS=$(jq -r '.os' "$CACHE")
ARCH=$(jq -r '.arch' "$CACHE")
NODE_VER=$(jq -r '.node' "$CACHE")
HAS_BUN=$(jq -r '.bun' "$CACHE")
HAS_DENO=$(jq -r '.deno' "$CACHE")

# Get diff (unstaged → staged → last commit)
DIFF=$(git diff HEAD 2>/dev/null)
[ -z "$DIFF" ] && DIFF=$(git diff 2>/dev/null)
[ -z "$DIFF" ] && DIFF=$(git diff HEAD~1 2>/dev/null)
[ -z "$DIFF" ] && {
  jq -n '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork review] No code changes to review."}}'
  exit 0
}

# Only look at added lines
ADDED=$(echo "$DIFF" | grep -E '^\+[^+]' | grep -v '^\+\+\+')

WARNINGS=""

# === 1. FAKE IMPORTS — check if imported modules actually exist ===
IMPORTS=$(echo "$ADDED" | grep -oE "from ['\"]([^'\"]+)['\"]" | sed "s/from ['\"]//;s/['\"]$//" | sort -u)
for imp in $IMPORTS; do
  # Skip relative imports and node: protocol
  echo "$imp" | grep -qE '^(\.|node:)' && continue
  # Check if package exists in node_modules or package.json
  PKG_NAME=$(echo "$imp" | sed 's|/.*||')
  if [ ! -d "node_modules/$PKG_NAME" ] 2>/dev/null; then
    if ! grep -q "\"$PKG_NAME\"" package.json 2>/dev/null; then
      WARNINGS="${WARNINGS}⚠️ Import '${PKG_NAME}' not found in dependencies\n"
    fi
  fi
done

# === 2. NONEXISTENT FILE REFS — relative imports pointing to missing files ===
REL_IMPORTS=$(echo "$ADDED" | grep -oE "from ['\"]\.\.?/[^'\"]+['\"]" | sed "s/from ['\"]//;s/['\"]$//" | head -10)
for rel in $REL_IMPORTS; do
  # Strip .js/.ts extension for resolution
  BASE=$(echo "$rel" | sed 's/\.[jt]sx\?$//')
  # Check common extensions
  FOUND=0
  for ext in .ts .tsx .js .jsx /index.ts /index.js ""; do
    [ -f "${BASE}${ext}" ] && FOUND=1 && break
  done
  if [ "$FOUND" = "0" ]; then
    WARNINGS="${WARNINGS}⚠️ Relative import '${rel}' — file not found\n"
  fi
done

# === 3. PLATFORM MISMATCH ===
if [ "$OS" != "Linux" ]; then
  HITS=$(echo "$ADDED" | grep -cE '(/proc/|cgroups|systemd|apt-get|yum |epoll_|inotify_init)')
  [ "$HITS" -gt 0 ] 2>/dev/null && WARNINGS="${WARNINGS}⚠️ ${HITS} Linux-specific patterns on ${OS}\n"
fi
if [ "$OS" != "Darwin" ]; then
  HITS=$(echo "$ADDED" | grep -cE '(launchd|NSApplication|CoreFoundation|IOKit|\.plist)')
  [ "$HITS" -gt 0 ] 2>/dev/null && WARNINGS="${WARNINGS}⚠️ ${HITS} macOS-specific patterns on ${OS}\n"
fi
if [ "$OS" != "MINGW" ] && [ "$OS" != "MSYS" ]; then
  HITS=$(echo "$ADDED" | grep -cE '(HKEY_|registry|\.exe|C:\\\\|cmd\.exe)')
  [ "$HITS" -gt 0 ] 2>/dev/null && WARNINGS="${WARNINGS}⚠️ ${HITS} Windows-specific patterns on ${OS}\n"
fi

# === 4. WRONG RUNTIME ===
if [ "$HAS_DENO" = "no" ]; then
  HITS=$(echo "$ADDED" | grep -cE 'Deno\.')
  [ "$HITS" -gt 0 ] 2>/dev/null && WARNINGS="${WARNINGS}⚠️ Deno API used but Deno not installed\n"
fi
if [ "$HAS_BUN" = "no" ]; then
  HITS=$(echo "$ADDED" | grep -cE '(Bun\.|from "bun")')
  [ "$HITS" -gt 0 ] 2>/dev/null && WARNINGS="${WARNINGS}⚠️ Bun API used but Bun not installed\n"
fi

# === 5. DEPRECATED PATTERNS ===
DEP_COUNT=$(echo "$ADDED" | grep -cE '(new Buffer\(|fs\.exists\(|url\.parse\(|path\.extname.*===)')
[ "$DEP_COUNT" -gt 0 ] 2>/dev/null && WARNINGS="${WARNINGS}⚠️ ${DEP_COUNT} deprecated Node.js patterns\n"

# === 6. SUSPICIOUS PATTERNS — common AI hallucination signatures ===
# Nonexistent method names that AI commonly fabricates
SUSPICIOUS=$(echo "$ADDED" | grep -cE '(\.(toJSON|toObject|toPlainObject|toSnakeCase|toCamelCase)\(|Array\.from\(.*\.entries\(\)\.map|console\.(success|fail|complete)\()')
[ "$SUSPICIOUS" -gt 0 ] 2>/dev/null && WARNINGS="${WARNINGS}⚠️ ${SUSPICIOUS} suspicious method calls (possibly hallucinated)\n"

# === 7. TYPE ASSERTION ABUSE ===
TYPE_ABUSE=$(echo "$ADDED" | grep -cE '(as any|@ts-ignore|@ts-nocheck|as unknown as)')
[ "$TYPE_ABUSE" -gt 0 ] 2>/dev/null && WARNINGS="${WARNINGS}⚠️ ${TYPE_ABUSE} type safety bypasses (as any, ts-ignore)\n"

# === Result ===
if [ -z "$WARNINGS" ]; then
  RESULT="✅ No issues"
else
  RESULT="${WARNINGS}"
fi

jq -n --arg result "$RESULT" \
  '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":("[bestwork review]\n" + $result)}}'
