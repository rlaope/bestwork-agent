#!/bin/bash
# nysm review agent — platform/context hallucination detector
# Checks if code matches actual OS, runtime, and project context

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .display // ""' 2>/dev/null)

# Only trigger on ./review or when sourced by smart-gateway
if ! echo "$PROMPT" | grep -qE '^\./review' && [ "$NYSM_REVIEW_TRIGGER" != "1" ]; then
  echo '{}'
  exit 0
fi

CACHE="$HOME/.nysm/env-cache.json"
mkdir -p "$HOME/.nysm"

# Build or refresh env cache (1-hour TTL)
REBUILD=0
if [ ! -f "$CACHE" ]; then
  REBUILD=1
elif [ "$(find "$CACHE" -mmin +60 2>/dev/null)" ]; then
  REBUILD=1
fi

if [ "$REBUILD" = "1" ]; then
  OS=$(uname -s)
  ARCH=$(uname -m)
  NODE_VER=$(node -v 2>/dev/null || echo "none")
  HAS_BUN=$(which bun 2>/dev/null && echo "yes" || echo "no")
  HAS_DENO=$(which deno 2>/dev/null && echo "yes" || echo "no")
  PKG_MGR="npm"
  [ -f "yarn.lock" ] && PKG_MGR="yarn"
  [ -f "pnpm-lock.yaml" ] && PKG_MGR="pnpm"
  [ -f "bun.lockb" ] && PKG_MGR="bun"

  jq -n \
    --arg os "$OS" \
    --arg arch "$ARCH" \
    --arg node "$NODE_VER" \
    --arg bun "$HAS_BUN" \
    --arg deno "$HAS_DENO" \
    --arg pkgmgr "$PKG_MGR" \
    '{os:$os, arch:$arch, node:$node, bun:$bun, deno:$deno, pkgMgr:$pkgmgr}' > "$CACHE"
fi

# Read env
OS=$(jq -r '.os' "$CACHE")
ARCH=$(jq -r '.arch' "$CACHE")
NODE_VER=$(jq -r '.node' "$CACHE")
HAS_BUN=$(jq -r '.bun' "$CACHE")
HAS_DENO=$(jq -r '.deno' "$CACHE")

# Scan git diff for platform-specific patterns
DIFF=$(git diff HEAD 2>/dev/null)
[ -z "$DIFF" ] && DIFF=$(git diff 2>/dev/null)
[ -z "$DIFF" ] && {
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm review] No code changes to review.\"}}"
  exit 0
}

WARNINGS=""

# Linux patterns on non-Linux
if [ "$OS" != "Linux" ]; then
  LINUX_HITS=$(echo "$DIFF" | grep -nE '(/proc/|cgroups|systemd|apt-get|yum |dnf |/etc/init\.d|epoll_|inotify_init)' | head -5)
  [ -n "$LINUX_HITS" ] && WARNINGS="${WARNINGS}\n⚠️ Linux-specific code detected on ${OS}:\n${LINUX_HITS}\n"
fi

# Windows patterns on non-Windows
if [ "$OS" != "MINGW" ] && [ "$OS" != "MSYS" ]; then
  WIN_HITS=$(echo "$DIFF" | grep -nE '(HKEY_|registry|\.exe|C:\\\\|powershell|cmd\.exe|CreateProcess)' | head -5)
  [ -n "$WIN_HITS" ] && WARNINGS="${WARNINGS}\n⚠️ Windows-specific code detected on ${OS}:\n${WIN_HITS}\n"
fi

# macOS patterns on non-macOS
if [ "$OS" != "Darwin" ]; then
  MAC_HITS=$(echo "$DIFF" | grep -nE '(launchd|defaults write|\.plist|NSApplication|CoreFoundation|IOKit)' | head -5)
  [ -n "$MAC_HITS" ] && WARNINGS="${WARNINGS}\n⚠️ macOS-specific code detected on ${OS}:\n${MAC_HITS}\n"
fi

# Runtime mismatches
if [ "$HAS_DENO" = "no" ]; then
  DENO_HITS=$(echo "$DIFF" | grep -nE '(Deno\.|import .* from "https://deno)' | head -3)
  [ -n "$DENO_HITS" ] && WARNINGS="${WARNINGS}\n⚠️ Deno API used but Deno not installed:\n${DENO_HITS}\n"
fi

if [ "$HAS_BUN" = "no" ]; then
  BUN_HITS=$(echo "$DIFF" | grep -nE '(Bun\.|Bun\.serve|import .* from "bun")' | head -3)
  [ -n "$BUN_HITS" ] && WARNINGS="${WARNINGS}\n⚠️ Bun API used but Bun not installed:\n${BUN_HITS}\n"
fi

# Deprecated/wrong Node.js patterns
DEPRECATED=$(echo "$DIFF" | grep -nE '(require\(.*\)|new Buffer\(|fs\.exists\()' | head -3)
[ -n "$DEPRECATED" ] && WARNINGS="${WARNINGS}\n⚠️ Deprecated Node.js patterns:\n${DEPRECATED}\n"

if [ -z "$WARNINGS" ]; then
  RESULT="[nysm review] ✅ No platform mismatches detected.\\nEnvironment: ${OS} ${ARCH}, Node ${NODE_VER}"
else
  RESULT="[nysm review] Platform review for ${OS} ${ARCH}, Node ${NODE_VER}:\\n${WARNINGS}\\nFix these mismatches before proceeding."
fi

echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"${RESULT}\"}}"
