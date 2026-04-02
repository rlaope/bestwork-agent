#!/bin/bash
# bestwork grounding hook — anti-hallucination
# PreToolUse on Edit/Write: warns if file wasn't Read first in this session
# This prevents the agent from editing files it hasn't seen

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')

# Only check Edit and Write
case "$TOOL" in
  Edit|Write) ;;
  *) echo '{}'; exit 0 ;;
esac

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
[ -z "$FILE_PATH" ] && echo '{}' && exit 0

# Check if this file was Read in this session's event log
BESTWORK_LOG="$HOME/.bestwork/data/${SESSION_ID}.jsonl"

if [ -f "$BESTWORK_LOG" ]; then
  WAS_READ=$(grep -c "\"toolName\":\"Read\".*$(echo "$FILE_PATH" | sed 's/[\/&]/\\&/g')" "$BESTWORK_LOG" 2>/dev/null)
  if [ "$WAS_READ" = "0" ] || [ -z "$WAS_READ" ]; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"[BW grounding] Warning: Attempting to ${TOOL} ${FILE_PATH} without reading it first in this session. Read the file first to avoid hallucinated content.\"}}"
    exit 0
  fi
fi

echo '{}'
