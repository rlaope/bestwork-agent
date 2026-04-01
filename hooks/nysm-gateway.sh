#!/bin/bash
# nysm gateway — intercepts Claude Code prompts and triggers nysm commands
# Installed via: nysm install

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .display // ""' 2>/dev/null)

LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

if echo "$LOWER" | grep -qE '(loop|루프).*(detect|감지|check|찾)'; then
  RESULT=$(nysm loops 2>&1)
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm loop detection]\\n${RESULT}\"}}"
  exit 0
fi

if echo "$LOWER" | grep -qE '(heatmap|히트맵|activity).*(show|보여|view)'; then
  RESULT=$(nysm heatmap 2>&1)
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm heatmap]\\n${RESULT}\"}}"
  exit 0
fi

if echo "$LOWER" | grep -qE '(session|세션).*(summary|요약|stats|통계)'; then
  RESULT=$(nysm summary 2>&1)
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm summary]\\n${RESULT}\"}}"
  exit 0
fi

if echo "$LOWER" | grep -qE '(weekly|주간).*(summary|report|요약|리포트)'; then
  RESULT=$(nysm summary -w 2>&1)
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm weekly summary]\\n${RESULT}\"}}"
  exit 0
fi

if echo "$LOWER" | grep -qE '(replay|리플레이|재생).*(session|세션)'; then
  SID=$(echo "$PROMPT" | grep -oE '[a-f0-9]{8}' | head -1)
  if [ -n "$SID" ]; then
    RESULT=$(nysm replay "$SID" 2>&1)
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm replay]\\n${RESULT}\"}}"
    exit 0
  fi
fi

echo '{}'
