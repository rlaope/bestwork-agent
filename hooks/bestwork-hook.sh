#!/bin/bash
# bestwork hook — captures tool call events to ~/.bestwork/data/
# Install: bestwork install

# Ensure project-local .bestwork/ structure exists (CWD = project root)
if [ ! -d ".bestwork" ]; then
  mkdir -p .bestwork/state .bestwork/plans .bestwork/logs .bestwork/sessions .bestwork/notepad
fi

# Auto-generate project context on first run
if [ ! -f ".bestwork/context/project-summary.md" ] && [ -d ".bestwork" ]; then
  mkdir -p .bestwork/context

  # Detect stack
  STACK=""
  [ -f "package.json" ] && STACK="Node.js ($(jq -r '.name // "unknown"' package.json))"
  [ -f "Cargo.toml" ] && STACK="Rust"
  [ -f "go.mod" ] && STACK="Go"
  [ -f "pyproject.toml" ] && STACK="Python"
  [ -f "requirements.txt" ] && [ -z "$STACK" ] && STACK="Python"
  [ -f "Gemfile" ] && STACK="Ruby"
  [ -f "build.gradle" ] && STACK="Java/Kotlin (Gradle)"
  [ -f "pom.xml" ] && STACK="Java (Maven)"

  # Build summary
  cat > .bestwork/context/project-summary.md << SUMMARY
# Project Context
**Stack**: ${STACK:-unknown}
**Generated**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
SUMMARY

  # Add package.json details if available
  if [ -f "package.json" ]; then
    DESC=$(jq -r '.description // ""' package.json)
    DEPS=$(jq -r '.dependencies | length // 0' package.json 2>/dev/null)
    DEVDEPS=$(jq -r '.devDependencies | length // 0' package.json 2>/dev/null)
    TEST_CMD=$(jq -r '.scripts.test // ""' package.json)
    BUILD_CMD=$(jq -r '.scripts.build // ""' package.json)

    cat >> .bestwork/context/project-summary.md << DETAILS
**Description**: ${DESC}
**Dependencies**: ${DEPS} prod, ${DEVDEPS} dev
**Test**: \`${TEST_CMD}\`
**Build**: \`${BUILD_CMD}\`
DETAILS
  fi

  # Add Cargo.toml details if available
  if [ -f "Cargo.toml" ] && command -v cargo >/dev/null 2>&1; then
    CARGO_NAME=$(grep '^name' Cargo.toml | head -1 | sed 's/.*= *"\(.*\)"/\1/')
    echo "**Crate**: ${CARGO_NAME}" >> .bestwork/context/project-summary.md
  fi

  # Add go.mod details if available
  if [ -f "go.mod" ]; then
    GO_MODULE=$(head -1 go.mod | awk '{print $2}')
    echo "**Module**: ${GO_MODULE}" >> .bestwork/context/project-summary.md
  fi

  # Add pyproject.toml details if available
  if [ -f "pyproject.toml" ]; then
    PY_NAME=$(grep '^name' pyproject.toml | head -1 | sed 's/.*= *"\(.*\)"/\1/')
    [ -n "$PY_NAME" ] && echo "**Package**: ${PY_NAME}" >> .bestwork/context/project-summary.md
  fi

  # Add directory structure
  echo -e "\n## Structure\n\`\`\`" >> .bestwork/context/project-summary.md
  ls -d */ 2>/dev/null | head -15 >> .bestwork/context/project-summary.md
  echo '```' >> .bestwork/context/project-summary.md
fi

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

# Also update ~/.claude/.session-stats.json so HUD can read it
if [ "$EVENT_TYPE" = "post" ] && [ "$SESSION_ID" != "unknown" ]; then
  STATS_FILE="$HOME/.claude/.session-stats.json"
  if [ -f "$STATS_FILE" ]; then
    UPDATED=$(jq --arg sid "$SESSION_ID" --arg tool "$TOOL_NAME" '
      .sessions[$sid] //= {"tool_counts":{}, "total_calls":0} |
      .sessions[$sid].tool_counts[$tool] = ((.sessions[$sid].tool_counts[$tool] // 0) + 1) |
      .sessions[$sid].total_calls = ((.sessions[$sid].total_calls // 0) + 1) |
      .sessions[$sid].updated_at = (now | floor)
    ' "$STATS_FILE" 2>/dev/null)
    [ -n "$UPDATED" ] && echo "$UPDATED" > "$STATS_FILE"
  else
    jq -n --arg sid "$SESSION_ID" --arg tool "$TOOL_NAME" '{
      sessions: { ($sid): { tool_counts: { ($tool): 1 }, total_calls: 1, started_at: (now|floor), updated_at: (now|floor) } }
    }' > "$STATS_FILE" 2>/dev/null
  fi
fi

# Return empty JSON (don't interfere with Claude Code)
echo '{}'
