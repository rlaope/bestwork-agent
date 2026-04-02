#!/bin/bash
# nysm strict mode enforcement
# PreToolUse hook — blocks dangerous operations when strict mode is on

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
STRICT_FILE="$HOME/.nysm/strict.lock"

[ ! -f "$STRICT_FILE" ] && echo '{}' && exit 0

# Block dangerous bash commands
if [ "$TOOL" = "Bash" ]; then
  CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

  # Block destructive operations
  if echo "$CMD" | grep -qE '(rm\s+-rf|git\s+push\s+--force|git\s+reset\s+--hard|git\s+clean\s+-f|DROP\s+TABLE|DELETE\s+FROM)'; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"[nysm strict] BLOCKED: Dangerous command detected: ${CMD}. Use ./relax to disable strict mode.\"}}"
    exit 0
  fi
fi

echo '{}'
