#!/bin/bash
# bestwork prompt completion — rich notification + auto-review + feedback loop detection
# Stop hook: fires when Claude Code finishes processing

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')

CONFIG="$HOME/.bestwork/config.json"
[ ! -f "$CONFIG" ] && echo '{}' && exit 0

DISCORD_URL=$(jq -r '.notify.discord.webhookUrl // empty' "$CONFIG" 2>/dev/null)
SLACK_URL=$(jq -r '.notify.slack.webhookUrl // empty' "$CONFIG" 2>/dev/null)

[ -z "$DISCORD_URL" ] && [ -z "$SLACK_URL" ] && echo '{}' && exit 0

# === Collect session data ===

CWD=$(pwd)
PROJECT=$(basename "$CWD")
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SID_SHORT="${SESSION_ID:0:8}"

# Last prompt (what the user asked)
LAST_PROMPT=""
if command -v bestwork &>/dev/null; then
  LAST_PROMPT=$(bestwork sessions -n 1 2>&1 | grep '💬' | head -1 | sed 's/.*💬 //')
fi

# Session stats
STATS=""
if command -v bestwork &>/dev/null; then
  TOTAL_CALLS=$(bestwork session "$SID_SHORT" 2>&1 | grep "Total calls" | sed 's/.*Total calls: //' | sed 's/ .*//')
  PROMPTS=$(bestwork session "$SID_SHORT" 2>&1 | grep "Prompts:" | sed 's/.*Prompts: //')
  STATS="Calls: ${TOTAL_CALLS:-?} | Prompts: ${PROMPTS:-?}"
fi

# Git changes summary
GIT_SUMMARY=""
if git rev-parse --is-inside-work-tree &>/dev/null; then
  CHANGED_FILES=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
  DIFF_STAT=$(git diff --stat 2>/dev/null | tail -1)

  if [ "$CHANGED_FILES" -gt 10 ] 2>/dev/null; then
    # Too many files — summarize key changes
    KEY_FILES=$(git diff --name-only 2>/dev/null | head -5 | tr '\n' ', ')
    GIT_SUMMARY="📦 ${CHANGED_FILES} files changed (key: ${KEY_FILES}...)\n${DIFF_STAT}"
  elif [ -n "$DIFF_STAT" ]; then
    GIT_SUMMARY="📦 ${DIFF_STAT}"
  fi

  STAGED_STAT=$(git diff --cached --stat 2>/dev/null | tail -1)
  [ -n "$STAGED_STAT" ] && GIT_SUMMARY="${GIT_SUMMARY}\n📋 Staged: ${STAGED_STAT}"
fi

# === Auto platform review ===
REVIEW_RESULT=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -n "$(git diff HEAD 2>/dev/null)" ] || [ -n "$(git diff 2>/dev/null)" ]; then
  REVIEW_OUTPUT=$(echo '{}' | BESTWORK_REVIEW_TRIGGER=1 bash "$SCRIPT_DIR/bestwork-review.sh" 2>/dev/null)
  if echo "$REVIEW_OUTPUT" | grep -q "⚠️"; then
    REVIEW_RESULT=$(echo "$REVIEW_OUTPUT" | jq -r '.hookSpecificOutput.additionalContext // ""' 2>/dev/null | head -10)
  fi
fi

# === Feedback loop detection ===
FEEDBACK_NOTE=""
BESTWORK_LOG="$HOME/.bestwork/data/${SESSION_ID}.jsonl"
if [ -f "$BESTWORK_LOG" ]; then
  TOTAL_EVENTS=$(wc -l < "$BESTWORK_LOG" | tr -d ' ')
  FAIL_EVENTS=$(grep -c '"event":"fail"' "$BESTWORK_LOG" 2>/dev/null || echo 0)
  EDIT_COUNT=$(grep -c '"toolName":"Edit"' "$BESTWORK_LOG" 2>/dev/null || echo 0)

  # Detect if session had too many issues
  if [ "$TOTAL_EVENTS" -gt 20 ] 2>/dev/null; then
    FAIL_RATIO=$(awk "BEGIN {printf \"%.0f\", ($FAIL_EVENTS / $TOTAL_EVENTS) * 100}")
    if [ "$FAIL_RATIO" -gt 20 ] 2>/dev/null; then
      FEEDBACK_NOTE="⚠️ High failure rate (${FAIL_RATIO}% of ${TOTAL_EVENTS} events). Consider reviewing approach."
    fi
  fi

  # Detect excessive edits on same files (loop indicator)
  if [ "$EDIT_COUNT" -gt 30 ] 2>/dev/null; then
    FEEDBACK_NOTE="${FEEDBACK_NOTE}\n🔄 High edit count (${EDIT_COUNT}). Possible loop pattern detected."
  fi
fi

# === Build notification message ===

TITLE="✅ ${PROJECT} — prompt complete"

BODY="**📝 Prompt:** ${LAST_PROMPT:-N/A}\n"
BODY="${BODY}**📊 Stats:** ${STATS}\n"
BODY="${BODY}**⏰ Time:** ${TIMESTAMP}\n"

[ -n "$GIT_SUMMARY" ] && BODY="${BODY}\n${GIT_SUMMARY}\n"

if [ -n "$REVIEW_RESULT" ]; then
  BODY="${BODY}\n**🔍 Platform Review:**\n${REVIEW_RESULT}\n"
else
  BODY="${BODY}\n**🔍 Platform Review:** ✅ No issues\n"
fi

if [ -n "$FEEDBACK_NOTE" ]; then
  BODY="${BODY}\n**⚡ Session Health:**\n${FEEDBACK_NOTE}\n"
fi

# === Send Discord ===
if [ -n "$DISCORD_URL" ]; then
  # Color: green if clean, yellow if warnings, red if feedback issues
  COLOR=55467  # green
  [ -n "$REVIEW_RESULT" ] && COLOR=16776960  # yellow
  [ -n "$FEEDBACK_NOTE" ] && COLOR=16711680  # red

  PAYLOAD=$(jq -n \
    --arg title "$TITLE" \
    --arg body "$BODY" \
    --argjson color "$COLOR" \
    '{
      "embeds": [{
        "title": $title,
        "description": $body,
        "color": $color,
        "footer": {"text": "bestwork — now you see me"},
        "timestamp": (now | todate)
      }]
    }')
  curl -s -X POST "$DISCORD_URL" -H "Content-Type: application/json" -d "$PAYLOAD" > /dev/null 2>&1
fi

# === Send Slack ===
if [ -n "$SLACK_URL" ]; then
  SLACK_BODY=$(echo -e "$BODY" | sed 's/\*\*/*/g')
  PAYLOAD=$(jq -n --arg title "$TITLE" --arg body "$SLACK_BODY" '{
    "blocks": [
      {"type": "header", "text": {"type": "plain_text", "text": $title}},
      {"type": "section", "text": {"type": "mrkdwn", "text": $body}},
      {"type": "context", "elements": [{"type": "mrkdwn", "text": "bestwork — now you see me"}]}
    ]
  }')
  curl -s -X POST "$SLACK_URL" -H "Content-Type: application/json" -d "$PAYLOAD" > /dev/null 2>&1
fi

echo '{}'
