#!/bin/bash
# nysm scope enforcement — blocks Edit/Write outside locked scope
# PreToolUse hook on Write|Edit

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
SCOPE_FILE="$HOME/.nysm/scope.lock"

# Only enforce on Edit/Write
case "$TOOL" in
  Edit|Write) ;;
  *) echo '{}'; exit 0 ;;
esac

# No scope lock = allow all
[ ! -f "$SCOPE_FILE" ] && echo '{}' && exit 0

SCOPE=$(cat "$SCOPE_FILE")
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

[ -z "$FILE_PATH" ] && echo '{}' && exit 0

# Check if file is within scope
if echo "$FILE_PATH" | grep -q "$SCOPE"; then
  echo '{}'
else
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"[nysm scope] BLOCKED: ${FILE_PATH} is outside scope '${SCOPE}'. Use ./unlock to remove restriction.\"}}"
fi
