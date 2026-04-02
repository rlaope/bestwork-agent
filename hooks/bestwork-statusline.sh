#!/bin/bash
# bestwork statusLine — rich HUD

VERSION="0.9.0"
CONFIG="$HOME/.bestwork/config.json"

# Colors
R="\033[0m" B="\033[1m" D="\033[2m"
CC="\033[36m" CG="\033[32m" CY="\033[33m" CR="\033[31m"
CM="\033[35m" CB="\033[34m" CW="\033[37m"

# Session uptime
ST=""
SESSIONS_DIR="$HOME/.claude/sessions"
if [ -d "$SESSIONS_DIR" ]; then
  LATEST=$(ls -t "$SESSIONS_DIR"/*.json 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    S=$(jq -r '.startedAt // empty' "$LATEST" 2>/dev/null)
    if [ -n "$S" ]; then
      [ "$S" -gt 1000000000000 ] 2>/dev/null && S=$((S / 1000))
      E=$(( $(date +%s) - S ))
      [ "$E" -lt 60 ] && ST="${E}s"
      [ "$E" -ge 60 ] && [ "$E" -lt 3600 ] && ST="$((E/60))m"
      [ "$E" -ge 3600 ] && ST="$((E/3600))h$((E%3600/60))m"
    fi
  fi
fi

# Weekly calls (better usage metric than wall-clock time)
STATS="$HOME/.claude/.session-stats.json"
WEEK_CALLS=0
SESSION_CALLS=0
if [ -f "$STATS" ]; then
  WEEK_START=$(date -v-$(date +%u)d +%s 2>/dev/null || date -d "last monday" +%s 2>/dev/null || echo 0)
  WEEK_CALLS=$(jq -r "[.sessions | to_entries[] | select(.value.started_at > $WEEK_START) | .value.total_calls] | add // 0" "$STATS" 2>/dev/null)

  if [ -n "$LATEST" ]; then
    SID=$(jq -r '.sessionId // empty' "$LATEST" 2>/dev/null)
    [ -n "$SID" ] && SESSION_CALLS=$(jq -r ".sessions[\"$SID\"].total_calls // 0" "$STATS" 2>/dev/null)
  fi
fi

# Usage percentage (estimate: ~8000 calls/week for heavy usage on Max plan)
WEEK_PCT=$((WEEK_CALLS * 100 / 8000))
[ "$WEEK_PCT" -gt 100 ] && WEEK_PCT=100

UC="$CG"
[ "$WEEK_PCT" -gt 50 ] && UC="$CY"
[ "$WEEK_PCT" -gt 80 ] && UC="$CR"

# Thin progress bar (3 chars)
F=$((WEEK_PCT * 3 / 100))
BAR=""
for i in $(seq 1 $F); do BAR="${BAR}▪"; done
for i in $(seq $((F+1)) 3); do BAR="${BAR}·"; done

# Notifications
N=""
[ -f "$CONFIG" ] && {
  [ -n "$(jq -r '.notify.discord.webhookUrl // empty' "$CONFIG" 2>/dev/null)" ] && N="📨"
  [ -n "$(jq -r '.notify.slack.webhookUrl // empty' "$CONFIG" 2>/dev/null)" ] && N="${N}📨"
}

# Guards
G=""
[ -f "$HOME/.bestwork/scope.lock" ] && G="🔒"
[ -f "$HOME/.bestwork/strict.lock" ] && G="${G}🛡"

# Build
O="${B}${CC}BW${R}${D}#${VERSION}${R}"
O="${O}  ${D}wk${R} ${UC}${WEEK_PCT}%${R}${D}${BAR}${R}"
[ -n "$ST" ] && O="${O}  ${D}ses${R} ${CW}${ST}${R}"
[ "$SESSION_CALLS" -gt 0 ] && O="${O}  ${D}calls${R} ${CM}${SESSION_CALLS}${R}"
[ -n "$G" ] && O="${O} ${G}"
[ -n "$N" ] && O="${O} ${N}"

echo -e "$O"
