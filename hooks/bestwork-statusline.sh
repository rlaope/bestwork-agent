#!/bin/bash
# bestwork statusLine — real-time session status bar
# Shows: version, session time, context usage, active agents, hook stats

VERSION="0.9.0"
CONFIG="$HOME/.bestwork/config.json"

# Session uptime (from .claude/sessions/)
SESSION_TIME=""
SESSIONS_DIR="$HOME/.claude/sessions"
if [ -d "$SESSIONS_DIR" ]; then
  LATEST=$(ls -t "$SESSIONS_DIR"/*.json 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    STARTED=$(jq -r '.startedAt // empty' "$LATEST" 2>/dev/null)
    if [ -n "$STARTED" ]; then
      # Convert to seconds elapsed
      if [ "$STARTED" -gt 1000000000000 ] 2>/dev/null; then
        STARTED=$((STARTED / 1000))
      fi
      NOW=$(date +%s)
      ELAPSED=$((NOW - STARTED))
      if [ "$ELAPSED" -lt 60 ]; then
        SESSION_TIME="${ELAPSED}s"
      elif [ "$ELAPSED" -lt 3600 ]; then
        SESSION_TIME="$((ELAPSED / 60))m"
      else
        SESSION_TIME="$((ELAPSED / 3600))h$((ELAPSED % 3600 / 60))m"
      fi
    fi
  fi
fi

# Active hooks count
HOOK_COUNT=0
if [ -f "$HOME/.claude/settings.json" ]; then
  HOOK_COUNT=$(jq '[.hooks // {} | to_entries[].value | length] | add // 0' "$HOME/.claude/settings.json" 2>/dev/null)
fi

# Plugin hook count from bestwork
BW_HOOKS=$(find "$HOME/.claude/plugins/cache/bestwork-tools" -name "hooks.json" 2>/dev/null | head -1)
if [ -n "$BW_HOOKS" ]; then
  BW_HOOK_COUNT=$(jq '[.hooks // {} | to_entries[].value | length] | add // 0' "$BW_HOOKS" 2>/dev/null)
  HOOK_COUNT=$((HOOK_COUNT + BW_HOOK_COUNT))
fi

# Notification status
NOTIFY=""
if [ -f "$CONFIG" ]; then
  HAS_DISCORD=$(jq -r '.notify.discord.webhookUrl // empty' "$CONFIG" 2>/dev/null)
  HAS_SLACK=$(jq -r '.notify.slack.webhookUrl // empty' "$CONFIG" 2>/dev/null)
  [ -n "$HAS_DISCORD" ] && NOTIFY="📨"
  [ -n "$HAS_SLACK" ] && NOTIFY="${NOTIFY}📨"
fi

# Scope/strict state
GUARDS=""
[ -f "$HOME/.bestwork/scope.lock" ] && GUARDS="🔒"
[ -f "$HOME/.bestwork/strict.lock" ] && GUARDS="${GUARDS}🛡️"

# Session stats from .session-stats.json
CALLS=""
STATS_FILE="$HOME/.claude/.session-stats.json"
if [ -f "$STATS_FILE" ] && [ -n "$LATEST" ]; then
  SID=$(jq -r '.sessionId // empty' "$LATEST" 2>/dev/null)
  if [ -n "$SID" ]; then
    TOTAL=$(jq -r ".sessions[\"$SID\"].total_calls // empty" "$STATS_FILE" 2>/dev/null)
    [ -n "$TOTAL" ] && CALLS="${TOTAL}calls"
  fi
fi

# Build output
OUTPUT="[BW#${VERSION}]"
[ -n "$SESSION_TIME" ] && OUTPUT="${OUTPUT} | session:${SESSION_TIME}"
[ -n "$CALLS" ] && OUTPUT="${OUTPUT} | ${CALLS}"
OUTPUT="${OUTPUT} | 🔧${HOOK_COUNT}"
[ -n "$NOTIFY" ] && OUTPUT="${OUTPUT} ${NOTIFY}"
[ -n "$GUARDS" ] && OUTPUT="${OUTPUT} ${GUARDS}"

echo "$OUTPUT"
