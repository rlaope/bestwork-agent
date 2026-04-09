#!/bin/bash
# bestwork requirement check — PostToolUse on Write|Edit
# Checks clarify/validate state files for unmet requirements
# Outputs warning if requirements are not yet covered

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')

# Only check Write and Edit
case "$TOOL" in
  Edit|Write) ;;
  *) echo '{}'; exit 0 ;;
esac

PROJECT_ROOT=$(pwd)
BESTWORK_STATE="${PROJECT_ROOT}/.bestwork/state"
STATS_FILE="${BESTWORK_STATE}/harness-stats.json"

# Initialize stats file if missing
if [ ! -f "$STATS_FILE" ]; then
  mkdir -p "$BESTWORK_STATE"
  echo '{"checksRun":0,"warningsIssued":0,"requirementsMet":0,"requirementsMissed":0,"lastUpdated":""}' > "$STATS_FILE"
fi

increment_stat() {
  local key="$1"
  local val
  val=$(jq -r ".$key" "$STATS_FILE" 2>/dev/null)
  [ -z "$val" ] || [ "$val" = "null" ] && val=0
  val=$((val + 1))
  local tmp
  tmp=$(mktemp)
  jq --arg k "$key" --argjson v "$val" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '.[$k] = $v | .lastUpdated = $ts' "$STATS_FILE" > "$tmp" && mv "$tmp" "$STATS_FILE"
}

# Track that we ran a check
increment_stat "checksRun"

WARNINGS=""

# === Check clarify state ===
CLARIFY_FILE="${BESTWORK_STATE}/clarify.json"
if [ -f "$CLARIFY_FILE" ]; then
  STATUS=$(jq -r '.status // ""' "$CLARIFY_FILE" 2>/dev/null)
  if [ "$STATUS" = "complete" ]; then
    OVERALL=$(jq -r '.overallScore // 0' "$CLARIFY_FILE" 2>/dev/null)
    OPEN_GAPS=$(jq -r '.openGaps | length // 0' "$CLARIFY_FILE" 2>/dev/null)
    if [ "$OPEN_GAPS" -gt 0 ] 2>/dev/null; then
      GAP_LIST=$(jq -r '.openGaps | join(", ")' "$CLARIFY_FILE" 2>/dev/null)
      WARNINGS="${WARNINGS}[BW gate] clarify: ${OPEN_GAPS} open gap(s) remaining — ${GAP_LIST}\n"
      increment_stat "requirementsMissed"
    else
      increment_stat "requirementsMet"
    fi
  fi
fi

# === Check validate state ===
VALIDATE_FILE="${BESTWORK_STATE}/validate.json"
if [ -f "$VALIDATE_FILE" ]; then
  STATUS=$(jq -r '.status // ""' "$VALIDATE_FILE" 2>/dev/null)
  if [ "$STATUS" = "complete" ]; then
    VERDICT=$(jq -r '.verdict // ""' "$VALIDATE_FILE" 2>/dev/null)
    OVERALL=$(jq -r '.scores.overall // 0' "$VALIDATE_FILE" 2>/dev/null)
    case "$VERDICT" in
      REJECTED)
        WARNINGS="${WARNINGS}[BW gate] validate: REJECTED (${OVERALL}%) — building a feature that failed validation\n"
        increment_stat "requirementsMissed"
        ;;
      WEAK)
        WARNINGS="${WARNINGS}[BW gate] validate: WEAK (${OVERALL}%) — thin evidence for this feature\n"
        increment_stat "requirementsMissed"
        ;;
      CONDITIONAL)
        # Info only, not a hard warning
        increment_stat "requirementsMet"
        ;;
      VALIDATED)
        increment_stat "requirementsMet"
        ;;
    esac
  fi
fi

# === Output ===
if [ -n "$WARNINGS" ]; then
  increment_stat "warningsIssued"
  CONTEXT=$(echo -e "$WARNINGS" | sed 's/\\n$//')
  jq -n --arg ctx "$CONTEXT" \
    '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":$ctx}}'
else
  echo '{}'
fi
