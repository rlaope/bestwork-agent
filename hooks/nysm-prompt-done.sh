#!/bin/bash
# nysm prompt completion notifier
# Fires on Stop event — sends summary to configured webhooks

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')

CONFIG="$HOME/.nysm/config.json"
[ ! -f "$CONFIG" ] && echo '{}' && exit 0

DISCORD_URL=$(jq -r '.notify.discord.webhookUrl // empty' "$CONFIG" 2>/dev/null)
SLACK_URL=$(jq -r '.notify.slack.webhookUrl // empty' "$CONFIG" 2>/dev/null)

[ -z "$DISCORD_URL" ] && [ -z "$SLACK_URL" ] && echo '{}' && exit 0

# Build summary
CWD=$(pwd)
PROJECT=$(basename "$CWD")
TIMESTAMP=$(date '+%H:%M:%S')

# Get git diff stat if available
GIT_STAT=""
if git rev-parse --is-inside-work-tree &>/dev/null; then
  DIFF=$(git diff --stat 2>/dev/null | tail -1)
  [ -n "$DIFF" ] && GIT_STAT="$DIFF"

  STAGED=$(git diff --cached --stat 2>/dev/null | tail -1)
  [ -n "$STAGED" ] && GIT_STAT="Staged: $STAGED"
fi

# Get session stats
STATS=""
if command -v nysm &>/dev/null; then
  CALLS=$(nysm session "${SESSION_ID:0:8}" 2>/dev/null | grep "Total calls" | head -1)
  [ -n "$CALLS" ] && STATS="$CALLS"
fi

BODY="**${PROJECT}** — Session \`${SESSION_ID:0:8}\` prompt completed at ${TIMESTAMP}"
[ -n "$GIT_STAT" ] && BODY="${BODY}\n\`\`\`${GIT_STAT}\`\`\`"
[ -n "$STATS" ] && BODY="${BODY}\n${STATS}"

# Send Discord
if [ -n "$DISCORD_URL" ]; then
  PAYLOAD=$(jq -n --arg body "$BODY" '{
    "embeds": [{
      "title": "🔍 Prompt Complete",
      "description": $body,
      "color": 55467,
      "timestamp": (now | todate)
    }]
  }')
  curl -s -X POST "$DISCORD_URL" -H "Content-Type: application/json" -d "$PAYLOAD" > /dev/null 2>&1
fi

# Send Slack
if [ -n "$SLACK_URL" ]; then
  SLACK_BODY=$(echo "$BODY" | sed 's/\\n/\n/g' | sed 's/\*\*/*/g')
  PAYLOAD=$(jq -n --arg body "$SLACK_BODY" '{
    "blocks": [
      {"type": "header", "text": {"type": "plain_text", "text": "🔍 Prompt Complete"}},
      {"type": "section", "text": {"type": "mrkdwn", "text": $body}}
    ]
  }')
  curl -s -X POST "$SLACK_URL" -H "Content-Type: application/json" -d "$PAYLOAD" > /dev/null 2>&1
fi

echo '{}'
