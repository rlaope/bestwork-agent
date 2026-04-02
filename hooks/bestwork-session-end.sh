#!/bin/bash
# bestwork session end hook — sends notification with session summary
# Triggered on Claude Code Stop event

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')

# Get session stats
STATS=$(bestwork session "$SESSION_ID" 2>&1 | head -20)

# Get git diff summary if in a git repo
GIT_SUMMARY=""
if git rev-parse --is-inside-work-tree &>/dev/null; then
  CHANGED=$(git diff --stat HEAD 2>/dev/null | tail -1)
  if [ -n "$CHANGED" ]; then
    GIT_SUMMARY="Git: ${CHANGED}"
  fi
fi

# Build notification body
BODY="Session \`${SESSION_ID:0:8}\` completed.

${STATS}
${GIT_SUMMARY}"

# Send notification via bestwork
bestwork notify --title "Session Complete" --body "$BODY" 2>/dev/null

echo '{}'
