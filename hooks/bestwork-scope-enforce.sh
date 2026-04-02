#!/bin/bash
# bestwork scope enforcement — blocks Edit/Write outside locked scope
# PreToolUse hook on Write|Edit

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
SCOPE_FILE="$HOME/.bestwork/scope.lock"

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

# Check if file is within scope using realpath prefix match
RESOLVED_FILE=$(realpath "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
RESOLVED_SCOPE=$(realpath "$SCOPE" 2>/dev/null || echo "$SCOPE")
if [[ "$RESOLVED_FILE" == "$RESOLVED_SCOPE"* ]]; then
  echo '{}'
else
  jq -n --arg file "$FILE_PATH" --arg scope "$SCOPE" \
    '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":("[bestwork scope] BLOCKED: " + $file + " is outside scope " + $scope + ". Use ./unlock to remove restriction.")}}'
fi
