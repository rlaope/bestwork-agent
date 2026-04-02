#!/bin/bash
# bestwork hook — captures tool call events to ~/.bestwork/data/
# Install: bestwork install

BESTWORK_DIR="$HOME/.bestwork/data"
mkdir -p "$BESTWORK_DIR"

# Read stdin (hook input JSON)
INPUT=$(cat)

# Extract fields
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"' | tr -cd 'a-zA-Z0-9_-')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
TIMESTAMP=$(date +%s%3N)

# Determine event type from environment or default to "post"
EVENT_TYPE="${BESTWORK_HOOK_EVENT:-post}"

# Build event JSON
EVENT=$(jq -n \
  --argjson ts "$TIMESTAMP" \
  --arg sid "$SESSION_ID" \
  --arg tool "$TOOL_NAME" \
  --arg evt "$EVENT_TYPE" \
  --argjson input "$(echo "$INPUT" | jq '.tool_input // {}')" \
  --argjson output "$(echo "$INPUT" | jq '.tool_response // {}')" \
  '{
    timestamp: $ts,
    sessionId: $sid,
    toolName: $tool,
    event: $evt,
    input: $input,
    output: $output
  }')

# Append to session file
echo "$EVENT" >> "$BESTWORK_DIR/${SESSION_ID}.jsonl"

# Return empty JSON (don't interfere with Claude Code)
echo '{}'
