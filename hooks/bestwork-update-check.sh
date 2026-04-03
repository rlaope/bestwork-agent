#!/bin/bash
# bestwork update checker — runs on SessionStart
# Checks npm registry for newer version, notifies via hookSpecificOutput
# Also injects last-session summary if available

# Dynamically resolve current version from package.json
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CURRENT_VERSION=$(jq -r '.version' "$SCRIPT_DIR/../package.json" 2>/dev/null || echo "0.0.0")

# Only check once per day (cache result)
CACHE="$HOME/.bestwork/update-check.json"
mkdir -p "$HOME/.bestwork"

UPDATE_MSG=""

if [ -f "$CACHE" ]; then
  CACHE_AGE=$(( $(date +%s) - $(stat -f %m "$CACHE" 2>/dev/null || stat -c %Y "$CACHE" 2>/dev/null || echo 0) ))
  if [ "$CACHE_AGE" -lt 86400 ]; then
    # Already checked today — read cached result
    LATEST=$(jq -r '.latest // empty' "$CACHE" 2>/dev/null)
    if [ -n "$LATEST" ] && [ "$LATEST" != "$CURRENT_VERSION" ]; then
      UPDATE_MSG="[BW] Update available: ${CURRENT_VERSION} → ${LATEST}\nRun /bestwork-agent:update or: claude plugin update bestwork-agent"
    fi
  else
    # Cache expired — fetch from npm registry (timeout 3s to not block startup)
    LATEST=$(curl -s --max-time 3 "https://registry.npmjs.org/bestwork-agent/latest" 2>/dev/null | jq -r '.version // empty' 2>/dev/null)

    if [ -n "$LATEST" ]; then
      # Cache the result
      jq -n --arg latest "$LATEST" --arg checked "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{latest: $latest, checked: $checked}' > "$CACHE"

      if [ "$LATEST" != "$CURRENT_VERSION" ]; then
        UPDATE_MSG="[BW] Update available: ${CURRENT_VERSION} → ${LATEST}\nRun /bestwork-agent:update or: claude plugin update bestwork-agent"
      fi
    fi
  fi
else
  # No cache — fetch from npm registry
  LATEST=$(curl -s --max-time 3 "https://registry.npmjs.org/bestwork-agent/latest" 2>/dev/null | jq -r '.version // empty' 2>/dev/null)

  if [ -n "$LATEST" ]; then
    jq -n --arg latest "$LATEST" --arg checked "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '{latest: $latest, checked: $checked}' > "$CACHE"

    if [ "$LATEST" != "$CURRENT_VERSION" ]; then
      UPDATE_MSG="[BW] Update available: ${CURRENT_VERSION} → ${LATEST}\nRun /bestwork-agent:update or: claude plugin update bestwork-agent"
    fi
  fi
fi

# Build additional context with optional last-session summary
ADDITIONAL_CONTEXT="$UPDATE_MSG"

if [ -f ".bestwork/state/last-session.md" ]; then
  LAST_SESSION=$(cat ".bestwork/state/last-session.md")
  if [ -n "$ADDITIONAL_CONTEXT" ]; then
    ADDITIONAL_CONTEXT="${ADDITIONAL_CONTEXT}\n\n${LAST_SESSION}"
  else
    ADDITIONAL_CONTEXT="$LAST_SESSION"
  fi
fi

if [ -n "$ADDITIONAL_CONTEXT" ]; then
  jq -n --arg ctx "$ADDITIONAL_CONTEXT" \
    '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":$ctx}}'
else
  echo '{}'
fi
