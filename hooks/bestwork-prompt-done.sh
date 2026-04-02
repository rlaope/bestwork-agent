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

# Last prompt for THIS session
LAST_PROMPT="N/A"
HISTORY_FILE="$HOME/.claude/history.jsonl"
if [ -f "$HISTORY_FILE" ]; then
  LAST_PROMPT=$(grep "\"sessionId\":\"${SESSION_ID}\"" "$HISTORY_FILE" | tail -1 | jq -r '.display // empty' 2>/dev/null | sed $'s/\x1b\[[0-9;]*m//g' | head -c 100)
fi
[ -z "$LAST_PROMPT" ] && LAST_PROMPT="N/A"

# Session stats
TOTAL_CALLS="?"
TOTAL_PROMPTS="?"
if command -v bestwork &>/dev/null; then
  RAW=$(bestwork session "$SID_SHORT" 2>&1 | sed $'s/\x1b\[[0-9;]*m//g')
  TOTAL_CALLS=$(echo "$RAW" | grep "Total calls" | sed 's/.*Total calls: //' | sed 's/ .*//' | tr -d ' ')
  TOTAL_PROMPTS=$(echo "$RAW" | grep "Prompts:" | sed 's/.*Prompts: //' | tr -d ' ')
fi

# Git: changed files list + diff stat
# Check: unstaged → staged → last commit
GIT_LINE="No changes"
CHANGED_FILES=""
CODE_SNIPPET=""
DIFF_SOURCE=""
if git rev-parse --is-inside-work-tree &>/dev/null; then
  # Try unstaged changes first
  DIFF_STAT=$(git diff --stat 2>/dev/null | tail -1 | tr -d '\n')
  [ -n "$DIFF_STAT" ] && DIFF_SOURCE="unstaged"

  # Then staged
  if [ -z "$DIFF_STAT" ]; then
    DIFF_STAT=$(git diff --cached --stat 2>/dev/null | tail -1 | tr -d '\n')
    [ -n "$DIFF_STAT" ] && DIFF_SOURCE="staged"
  fi

  # Then last commit (most common — changes already committed)
  if [ -z "$DIFF_STAT" ]; then
    DIFF_STAT=$(git diff HEAD~1 --stat 2>/dev/null | tail -1 | tr -d '\n')
    [ -n "$DIFF_STAT" ] && DIFF_SOURCE="committed"
  fi

  if [ -n "$DIFF_STAT" ]; then
    GIT_LINE="$DIFF_STAT"

    case "$DIFF_SOURCE" in
      unstaged)  FILES=$(git diff --name-only 2>/dev/null | head -5) ;;
      staged)    FILES=$(git diff --cached --name-only 2>/dev/null | head -5) ;;
      committed) FILES=$(git diff HEAD~1 --name-only 2>/dev/null | head -5) ;;
    esac
    [ -n "$FILES" ] && CHANGED_FILES=$(echo "$FILES" | tr '\n' ', ' | sed 's/,$//')

    case "$DIFF_SOURCE" in
      unstaged)  CODE_SNIPPET=$(git diff 2>/dev/null | grep -E '^\+[^+]' | grep -v '^\+\+\+' | head -8 | sed 's/^\+//' | head -c 300) ;;
      staged)    CODE_SNIPPET=$(git diff --cached 2>/dev/null | grep -E '^\+[^+]' | grep -v '^\+\+\+' | head -8 | sed 's/^\+//' | head -c 300) ;;
      committed) CODE_SNIPPET=$(git diff HEAD~1 2>/dev/null | grep -E '^\+[^+]' | grep -v '^\+\+\+' | head -8 | sed 's/^\+//' | head -c 300) ;;
    esac
  fi
fi

# Hallucination review — run full review, extract all warnings
REVIEW_LINE="✅ No issues"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REVIEW_OUTPUT=$(echo '{}' | BESTWORK_REVIEW_TRIGGER=1 bash "$SCRIPT_DIR/bestwork-review.sh" 2>/dev/null)
REVIEW_CONTENT=$(echo "$REVIEW_OUTPUT" | jq -r '.hookSpecificOutput.additionalContext // ""' 2>/dev/null)
if echo "$REVIEW_CONTENT" | grep -q "⚠️"; then
  # Extract all warning lines, strip the [bestwork review] header
  REVIEW_LINE=$(echo "$REVIEW_CONTENT" | grep "⚠️" | head -5 | sed 's/^ *//')
fi

# === Send Discord ===
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
    --arg files "${CHANGED_FILES:-none}" \
    --arg snippet "${CODE_SNIPPET:-}" \
    --arg review "$REVIEW_LINE" \
    --argjson color "$COLOR" \
    '{
      embeds: [{
        title: ("bestwork-agent result — " + $project),
        description: (
          "**Prompt:** " + $prompt +
          "\n\n**Stats:** " + $calls + " calls | " + $prompts + " prompts" +
          "\n**Time:** " + $time +
          "\n\n**Changes:** " + $git +
          "\n**Files:** " + $files +
          (if $snippet != "" then ("\n```\n" + $snippet + "\n```") else "" end) +
          "\n\n**Review:** " + $review
        ),
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
    --arg files "${CHANGED_FILES:-none}" \
    --arg snippet "${CODE_SNIPPET:-}" \
    --arg review "$REVIEW_LINE" \
    '{
      blocks: [
        {type: "header", text: {type: "plain_text", text: ("bestwork-agent result — " + $project)}},
        {type: "section", text: {type: "mrkdwn", text: (
          "*Prompt:* " + $prompt +
          "\n\n*Stats:* " + $calls + " calls | " + $prompts + " prompts" +
          "\n*Time:* " + $time +
          "\n\n*Changes:* " + $git +
          "\n*Files:* " + $files +
          (if $snippet != "" then ("\n```\n" + $snippet + "\n```") else "" end) +
          "\n\n*Review:* " + $review
        )}},
        {type: "context", elements: [{type: "mrkdwn", text: "bestwork-agent"}]}
      ]
    }' | curl -s -X POST "$SLACK_URL" -H "Content-Type: application/json" -d @- > /dev/null 2>&1
fi

echo '{}'
