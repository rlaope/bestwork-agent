#!/bin/bash
# bestwork validation hook — auto-typecheck after code changes
# PostToolUse on Edit/Write: runs typecheck if the file is .ts/.tsx/.js/.jsx

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')

case "$TOOL" in
  Edit|Write) ;;
  *) echo '{}'; exit 0 ;;
esac

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_response.filePath // ""')
[ -z "$FILE_PATH" ] && echo '{}' && exit 0

# Only validate code files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) echo '{}'; exit 0 ;;
esac

# Find project root (look for tsconfig.json or package.json)
DIR=$(dirname "$FILE_PATH")
PROJECT_ROOT=""
while [ "$DIR" != "/" ]; do
  if [ -f "$DIR/tsconfig.json" ]; then
    PROJECT_ROOT="$DIR"
    break
  fi
  DIR=$(dirname "$DIR")
done

[ -z "$PROJECT_ROOT" ] && echo '{}' && exit 0

# Run typecheck (non-blocking, timeout 10s)
ERRORS=$(cd "$PROJECT_ROOT" && timeout 10 npx tsc --noEmit 2>&1 | grep "error TS" | head -5)

if [ -n "$ERRORS" ]; then
  ESCAPED=$(echo "$ERRORS" | head -5 | tr '\n' ' ' | sed 's/"/\\"/g')
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"[bestwork validate] TypeScript errors after ${TOOL}:\\n${ESCAPED}\"}}"
else
  echo '{}'
fi
