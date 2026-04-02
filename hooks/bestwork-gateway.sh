#!/bin/bash
# bestwork gateway — intercepts Claude Code prompts and triggers bestwork commands
# Installed via: bestwork install

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .display // ""' 2>/dev/null)

LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

if echo "$LOWER" | grep -qE '(loop|루프).*(detect|감지|check|찾)'; then
  RESULT=$(bestwork loops 2>&1)
  jq -n --arg result "[BW loops]\n$RESULT" \
    '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":$result}}'
  exit 0
fi

if echo "$LOWER" | grep -qE '(heatmap|히트맵|activity).*(show|보여|view)'; then
  RESULT=$(bestwork heatmap 2>&1)
  jq -n --arg result "[BW heatmap]\n$RESULT" \
    '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":$result}}'
  exit 0
fi

if echo "$LOWER" | grep -qE '(session|세션).*(summary|요약|stats|통계)'; then
  RESULT=$(bestwork summary 2>&1)
  jq -n --arg result "[BW summary]\n$RESULT" \
    '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":$result}}'
  exit 0
fi

if echo "$LOWER" | grep -qE '(weekly|주간).*(summary|report|요약|리포트)'; then
  RESULT=$(bestwork summary -w 2>&1)
  jq -n --arg result "[BW weekly]\n$RESULT" \
    '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":$result}}'
  exit 0
fi

if echo "$LOWER" | grep -qE '(replay|리플레이|재생).*(session|세션)'; then
  SID=$(echo "$PROMPT" | grep -oE '[a-f0-9]{8}' | head -1)
  if [ -n "$SID" ]; then
    RESULT=$(bestwork replay "$SID" 2>&1)
    jq -n --arg result "[BW replay]\n$RESULT" \
      '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":$result}}'
    exit 0
  fi
fi

echo '{}'
