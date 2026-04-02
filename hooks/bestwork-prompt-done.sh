#!/bin/bash
# bestwork prompt completion — rich notification
# Stop hook: fires when Claude Code finishes processing

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')

CONFIG="$HOME/.bestwork/config.json"
[ ! -f "$CONFIG" ] && echo '{}' && exit 0

DISCORD_URL=$(jq -r '.notify.discord.webhookUrl // empty' "$CONFIG" 2>/dev/null)
SLACK_URL=$(jq -r '.notify.slack.webhookUrl // empty' "$CONFIG" 2>/dev/null)

[ -z "$DISCORD_URL" ] && [ -z "$SLACK_URL" ] && echo '{}' && exit 0

# === Collect data ===

CWD=$(pwd)
PROJECT=$(basename "$CWD")
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SID_SHORT="${SESSION_ID:0:8}"

# Last prompt — strip ANSI escape codes
LAST_PROMPT=""
if command -v bestwork &>/dev/null; then
  LAST_PROMPT=$(bestwork sessions -n 1 2>&1 | grep '💬' | head -1 | sed 's/.*💬 //' | sed 's/\x1b\[[0-9;]*m//g' | head -c 100)
fi
[ -z "$LAST_PROMPT" ] && LAST_PROMPT="N/A"

# Session stats — strip ANSI
TOTAL_CALLS="?"
TOTAL_PROMPTS="?"
if command -v bestwork &>/dev/null; then
  RAW=$(bestwork session "$SID_SHORT" 2>&1 | sed 's/\x1b\[[0-9;]*m//g')
  TOTAL_CALLS=$(echo "$RAW" | grep "Total calls" | sed 's/.*Total calls: //' | sed 's/ .*//' | tr -d ' ')
  TOTAL_PROMPTS=$(echo "$RAW" | grep "Prompts:" | sed 's/.*Prompts: //' | tr -d ' ')
fi

# Git changes
GIT_LINE=""
if git rev-parse --is-inside-work-tree &>/dev/null; then
  DIFF_STAT=$(git diff --stat 2>/dev/null | tail -1 | tr -d '\n')
  [ -n "$DIFF_STAT" ] && GIT_LINE="$DIFF_STAT"
fi

# Platform review
REVIEW_LINE="✅ No issues"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -n "$(git diff HEAD 2>/dev/null)" ] || [ -n "$(git diff 2>/dev/null)" ]; then
  REVIEW_OUTPUT=$(echo '{}' | BESTWORK_REVIEW_TRIGGER=1 bash "$SCRIPT_DIR/bestwork-review.sh" 2>/dev/null)
  if echo "$REVIEW_OUTPUT" | grep -q "⚠️"; then
    REVIEW_LINE="⚠️ Platform mismatches found"
  fi
fi

# === Send Discord ===
if [ -n "$DISCORD_URL" ]; then
  COLOR=55467
  echo "$REVIEW_LINE" | grep -q "⚠️" && COLOR=16776960

  # Build description with jq to handle escaping properly
  DESC=$(jq -n \
    --arg prompt "$LAST_PROMPT" \
    --arg calls "$TOTAL_CALLS" \
    --arg prompts "$TOTAL_PROMPTS" \
    --arg time "$TIMESTAMP" \
    --arg git "${GIT_LINE:-No changes}" \
    --arg review "$REVIEW_LINE" \
    '"**Prompt:** " + $prompt + "\n\n**Stats:** " + $calls + " calls | " + $prompts + " prompts\n**Time:** " + $time + "\n**Git:** " + $git + "\n**Review:** " + $review')

  # Remove outer quotes from jq output
  DESC=$(echo "$DESC" | sed 's/^"//;s/"$//')

  PAYLOAD=$(jq -n \
    --arg title "bestwork-agent result — ${PROJECT}" \
    --arg desc "$DESC" \
    --argjson color "$COLOR" \
    '{
      "embeds": [{
        "title": $title,
        "description": $desc,
        "color": $color,
        "footer": {"text": "bestwork-agent"},
        "timestamp": (now | todate)
      }]
    }')

  curl -s -X POST "$DISCORD_URL" -H "Content-Type: application/json" -d "$PAYLOAD" > /dev/null 2>&1
fi

# === Send Slack ===
if [ -n "$SLACK_URL" ]; then
  SLACK_DESC=$(jq -n \
    --arg prompt "$LAST_PROMPT" \
    --arg calls "$TOTAL_CALLS" \
    --arg prompts "$TOTAL_PROMPTS" \
    --arg time "$TIMESTAMP" \
    --arg git "${GIT_LINE:-No changes}" \
    --arg review "$REVIEW_LINE" \
    '"*Prompt:* " + $prompt + "\n\n*Stats:* " + $calls + " calls | " + $prompts + " prompts\n*Time:* " + $time + "\n*Git:* " + $git + "\n*Review:* " + $review')

  SLACK_DESC=$(echo "$SLACK_DESC" | sed 's/^"//;s/"$//')

  PAYLOAD=$(jq -n \
    --arg title "bestwork-agent result — ${PROJECT}" \
    --arg body "$SLACK_DESC" \
    '{
      "blocks": [
        {"type": "header", "text": {"type": "plain_text", "text": $title}},
        {"type": "section", "text": {"type": "mrkdwn", "text": $body}},
        {"type": "context", "elements": [{"type": "mrkdwn", "text": "bestwork-agent"}]}
      ]
    }')

  curl -s -X POST "$SLACK_URL" -H "Content-Type: application/json" -d "$PAYLOAD" > /dev/null 2>&1
fi

echo '{}'
