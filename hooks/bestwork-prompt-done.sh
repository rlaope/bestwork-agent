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

CWD=$(pwd)
PROJECT=$(jq -r '.name // empty' "$CWD/package.json" 2>/dev/null)
[ -z "$PROJECT" ] && PROJECT=$(basename "$CWD")
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SID_SHORT="${SESSION_ID:0:8}"

LAST_PROMPT="N/A"
if command -v bestwork &>/dev/null; then
  LAST_PROMPT=$(bestwork sessions -n 1 2>&1 | grep '💬' | head -1 | sed 's/.*💬 //' | sed $'s/\x1b\[[0-9;]*m//g' | head -c 100)
fi
[ -z "$LAST_PROMPT" ] && LAST_PROMPT="N/A"

TOTAL_CALLS="?"
TOTAL_PROMPTS="?"
if command -v bestwork &>/dev/null; then
  RAW=$(bestwork session "$SID_SHORT" 2>&1 | sed $'s/\x1b\[[0-9;]*m//g')
  TOTAL_CALLS=$(echo "$RAW" | grep "Total calls" | sed 's/.*Total calls: //' | sed 's/ .*//' | tr -d ' ')
  TOTAL_PROMPTS=$(echo "$RAW" | grep "Prompts:" | sed 's/.*Prompts: //' | tr -d ' ')
fi

GIT_LINE="No changes"
if git rev-parse --is-inside-work-tree &>/dev/null; then
  DIFF_STAT=$(git diff --stat 2>/dev/null | tail -1 | tr -d '\n')
  [ -n "$DIFF_STAT" ] && GIT_LINE="$DIFF_STAT"
fi

REVIEW_LINE="✅ No issues"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -n "$(git diff HEAD 2>/dev/null)" ] || [ -n "$(git diff 2>/dev/null)" ]; then
  REVIEW_OUTPUT=$(echo '{}' | BESTWORK_REVIEW_TRIGGER=1 bash "$SCRIPT_DIR/bestwork-review.sh" 2>/dev/null)
  if echo "$REVIEW_OUTPUT" | grep -q "⚠️"; then
    REVIEW_LINE="⚠️ Platform mismatches found"
  fi
fi

# === Send Discord — single jq call, no intermediate variables ===
if [ -n "$DISCORD_URL" ]; then
  COLOR=55467
  echo "$REVIEW_LINE" | grep -q "⚠️" && COLOR=16776960

  jq -n \
    --arg project "$PROJECT" \
    --arg prompt "$LAST_PROMPT" \
    --arg calls "${TOTAL_CALLS:-?}" \
    --arg prompts "${TOTAL_PROMPTS:-?}" \
    --arg time "$TIMESTAMP" \
    --arg git "$GIT_LINE" \
    --arg review "$REVIEW_LINE" \
    --argjson color "$COLOR" \
    '{
      embeds: [{
        title: ("bestwork-agent result — " + $project),
        description: ("**Prompt:** " + $prompt + "\n\n**Stats:** " + $calls + " calls | " + $prompts + " prompts\n**Time:** " + $time + "\n**Git:** " + $git + "\n**Review:** " + $review),
        color: $color,
        footer: {text: "bestwork-agent"},
        timestamp: (now | todate)
      }]
    }' | curl -s -X POST "$DISCORD_URL" -H "Content-Type: application/json" -d @- > /dev/null 2>&1
fi

# === Send Slack ===
if [ -n "$SLACK_URL" ]; then
  jq -n \
    --arg project "$PROJECT" \
    --arg prompt "$LAST_PROMPT" \
    --arg calls "${TOTAL_CALLS:-?}" \
    --arg prompts "${TOTAL_PROMPTS:-?}" \
    --arg time "$TIMESTAMP" \
    --arg git "$GIT_LINE" \
    --arg review "$REVIEW_LINE" \
    '{
      blocks: [
        {type: "header", text: {type: "plain_text", text: ("bestwork-agent result — " + $project)}},
        {type: "section", text: {type: "mrkdwn", text: ("*Prompt:* " + $prompt + "\n\n*Stats:* " + $calls + " calls | " + $prompts + " prompts\n*Time:* " + $time + "\n*Git:* " + $git + "\n*Review:* " + $review)}},
        {type: "context", elements: [{type: "mrkdwn", text: "bestwork-agent"}]}
      ]
    }' | curl -s -X POST "$SLACK_URL" -H "Content-Type: application/json" -d @- > /dev/null 2>&1
fi

echo '{}'
