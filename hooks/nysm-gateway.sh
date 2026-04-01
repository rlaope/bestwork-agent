#!/bin/bash
# nysm gateway — intercepts Claude Code prompts and triggers nysm commands
# Installed via: nysm install

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .display // ""' 2>/dev/null)

# Normalize to lowercase for matching
LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# Route to nysm commands based on keywords
if echo "$LOWER" | grep -qE '(루프|loop).*(감지|detect|찾|check)'; then
  RESULT=$(nysm loops 2>&1)
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm loop detection result]\\n${RESULT}\"}}"
  exit 0
fi

if echo "$LOWER" | grep -qE '(히트맵|heatmap|활동|activity).*(보여|show|확인)'; then
  RESULT=$(nysm heatmap 2>&1)
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm heatmap]\\n${RESULT}\"}}"
  exit 0
fi

if echo "$LOWER" | grep -qE '(세션|session).*(요약|summary|통계|stats)'; then
  RESULT=$(nysm summary 2>&1)
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm summary]\\n${RESULT}\"}}"
  exit 0
fi

if echo "$LOWER" | grep -qE '(주간|weekly|이번.?주).*(요약|summary|리포트|report)'; then
  RESULT=$(nysm summary -w 2>&1)
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm weekly summary]\\n${RESULT}\"}}"
  exit 0
fi

if echo "$LOWER" | grep -qE '(리플레이|replay|재생).*(세션|session)'; then
  # Extract session ID if present
  SID=$(echo "$PROMPT" | grep -oE '[a-f0-9]{8}' | head -1)
  if [ -n "$SID" ]; then
    RESULT=$(nysm replay "$SID" 2>&1)
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm replay]\\n${RESULT}\"}}"
    exit 0
  fi
fi

# No match — pass through
echo '{}'
