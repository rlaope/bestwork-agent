#!/bin/bash
# bestwork update checker — runs on SessionStart
# Checks npm registry for newer version, notifies via hookSpecificOutput

CURRENT_VERSION="0.8.0"

# Only check once per day (cache result)
CACHE="$HOME/.bestwork/update-check.json"
mkdir -p "$HOME/.bestwork"

if [ -f "$CACHE" ]; then
  CACHE_AGE=$(( $(date +%s) - $(stat -f %m "$CACHE" 2>/dev/null || stat -c %Y "$CACHE" 2>/dev/null || echo 0) ))
  if [ "$CACHE_AGE" -lt 86400 ]; then
    # Already checked today — read cached result
    LATEST=$(jq -r '.latest // empty' "$CACHE" 2>/dev/null)
    if [ -n "$LATEST" ] && [ "$LATEST" != "$CURRENT_VERSION" ]; then
      jq -n --arg current "$CURRENT_VERSION" --arg latest "$LATEST" \
        '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":("[bestwork] Update available: " + $current + " → " + $latest + "\nRun: npm install -g bestwork-agent@latest && bestwork install")}}'
    else
      echo '{}'
    fi
    exit 0
  fi
fi

# Check npm registry (timeout 3s to not block startup)
LATEST=$(curl -s --max-time 3 "https://registry.npmjs.org/bestwork-agent/latest" 2>/dev/null | jq -r '.version // empty' 2>/dev/null)

if [ -z "$LATEST" ]; then
  echo '{}'
  exit 0
fi

# Cache the result
jq -n --arg latest "$LATEST" --arg checked "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{latest: $latest, checked: $checked}' > "$CACHE"

if [ "$LATEST" != "$CURRENT_VERSION" ]; then
  jq -n --arg current "$CURRENT_VERSION" --arg latest "$LATEST" \
    '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":("[bestwork] Update available: " + $current + " → " + $latest + "\nRun: npm install -g bestwork-agent@latest && bestwork install")}}'
else
  echo '{}'
fi
