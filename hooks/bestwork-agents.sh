#!/bin/bash
# bestwork unique agents — powered by session data that only bestwork has
# These agents are impossible without bestwork's observability layer

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .display // ""' 2>/dev/null)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"' 2>/dev/null)

# --- ./autopsy <id> — deep post-mortem of a session ---
# "Why did that session go wrong?" — analyzes tool call patterns, loops, failures
if echo "$PROMPT" | grep -qE '^\./autopsy'; then
  TARGET=$(echo "$PROMPT" | sed 's|^\./autopsy\s*||' | tr -d ' ')
  [ -z "$TARGET" ] && TARGET="$SESSION_ID"

  STATS=$(bestwork session "${TARGET}" 2>&1)
  LOOPS=$(bestwork loops 2>&1)
  OUTCOME=$(bestwork outcome "${TARGET}" 2>&1)

  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork agent: autopsy]\nPerform a deep post-mortem analysis of session ${TARGET}.\n\nSession data:\n${STATS}\n\nLoop detection:\n${LOOPS}\n\nOutcome:\n${OUTCOME}\n\nAnalyze:\n1. Was this session productive or struggling? Why?\n2. Where did the agent get stuck? (repeated tool+file patterns)\n3. What was the root cause of any failures?\n4. What could the user have prompted differently?\n5. Actionable recommendations for next time"}}
EOJSON
  exit 0
fi

# --- ./similar — find past sessions with similar patterns ---
# "I've seen this before" — searches session history for matching tool patterns
if echo "$PROMPT" | grep -qE '^\./similar'; then
  QUERY=$(echo "$PROMPT" | sed 's|^\./similar\s*||')
  SESSIONS=$(bestwork sessions -n 20 2>&1)
  CURRENT=$(bestwork session "${SESSION_ID:0:8}" 2>&1)

  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork agent: similar]\nFind past sessions similar to the current one and extract lessons.\n\nCurrent session:\n${CURRENT}\n\nUser is looking for: ${QUERY}\n\nAll sessions:\n${SESSIONS}\n\nAnalyze:\n1. Which past sessions had similar tool call patterns?\n2. Which past sessions worked on similar projects (same CWD)?\n3. What worked well in efficient sessions vs what went wrong in struggling ones?\n4. Extract actionable patterns the user can apply now"}}
EOJSON
  exit 0
fi

# --- ./learn — extract rules from your most productive sessions ---
# Turns session data into actionable prompting guidelines
if echo "$PROMPT" | grep -qE '^\./learn'; then
  EFFECTIVENESS=$(bestwork effectiveness 2>&1)
  SESSIONS=$(bestwork sessions -n 20 2>&1)
  SUMMARY=$(bestwork summary -w 2>&1)

  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork agent: learn]\nAnalyze my session history and teach me how to prompt better.\n\nEffectiveness trend:\n${EFFECTIVENESS}\n\nRecent sessions:\n${SESSIONS}\n\nWeekly summary:\n${SUMMARY}\n\nProvide:\n1. My prompting patterns — what do I do well vs poorly?\n2. Which types of tasks am I most/least efficient at?\n3. Specific rules: 'When doing X, always include Y in your prompt'\n4. Time-of-day patterns — am I more productive at certain times?\n5. Concrete before/after prompt examples from my actual history"}}
EOJSON
  exit 0
fi

# --- ./predict — estimate task complexity from history ---
# "How hard will this be?" based on similar past sessions
if echo "$PROMPT" | grep -qE '^\./predict'; then
  TASK=$(echo "$PROMPT" | sed 's|^\./predict\s*||')
  SESSIONS=$(bestwork sessions -n 15 2>&1)
  EFFECTIVENESS=$(bestwork effectiveness 2>&1)

  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork agent: predict]\nPredict the complexity of this task: ${TASK}\n\nMy session history:\n${SESSIONS}\n\nEffectiveness:\n${EFFECTIVENESS}\n\nBased on my history:\n1. How many calls will this likely take?\n2. What's the estimated time?\n3. Should I break this into smaller tasks?\n4. What's the risk of the agent looping?\n5. Recommended approach based on what worked for similar tasks"}}
EOJSON
  exit 0
fi

# --- ./guard — activate session-aware guardrails ---
# Proactive warnings based on current session trajectory
if echo "$PROMPT" | grep -qE '^\./guard'; then
  CURRENT=$(bestwork session "${SESSION_ID:0:8}" 2>&1)
  OUTCOME=$(bestwork outcome "${SESSION_ID:0:8}" 2>&1)
  LOOPS=$(bestwork loops 2>&1)

  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork agent: guard]\nAnalyze the current session health and set up guardrails.\n\nCurrent session:\n${CURRENT}\n\nOutcome analysis:\n${OUTCOME}\n\nLoop detection:\n${LOOPS}\n\nProvide:\n1. Is this session on track or drifting?\n2. Warning signs of incoming loops or struggles\n3. Suggestions to course-correct if needed\n4. Estimated remaining complexity"}}
EOJSON
  exit 0
fi

# --- ./compare <id1> <id2> — compare two sessions ---
if echo "$PROMPT" | grep -qE '^\./compare'; then
  IDS=$(echo "$PROMPT" | sed 's|^\./compare\s*||')
  ID1=$(echo "$IDS" | awk '{print $1}')
  ID2=$(echo "$IDS" | awk '{print $2}')

  S1=$(bestwork session "$ID1" 2>&1)
  S2=$(bestwork session "$ID2" 2>&1)
  O1=$(bestwork outcome "$ID1" 2>&1)
  O2=$(bestwork outcome "$ID2" 2>&1)

  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork agent: compare]\nCompare these two sessions:\n\nSession 1 (${ID1}):\n${S1}\n${O1}\n\nSession 2 (${ID2}):\n${S2}\n${O2}\n\nAnalyze:\n1. Which session was more productive and why?\n2. Tool usage differences\n3. What made the efficient session work better?\n4. Lessons to apply from the better session"}}
EOJSON
  exit 0
fi

# --- ./help — list bestwork-unique commands ---
if echo "$PROMPT" | grep -qE '^\./help'; then
  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork commands]\n\nSetup:\n  ./discord <url>        Discord notifications\n  ./slack <url>          Slack notifications\n  ./bestwork                 Status check\n\nData-Driven Agents (bestwork-exclusive):\n  ./autopsy [id]         Deep post-mortem of a session\n  ./similar [query]      Find similar past sessions & extract lessons\n  ./learn                Extract prompting rules from your history\n  ./predict <task>       Predict task complexity from past data\n  ./guard                Session health check & guardrails\n  ./compare <id1> <id2>  Compare two sessions side-by-side\n\nObservability (natural language):\n  detect loops           Loop detection\n  show heatmap           Activity heatmap\n  session summary        Today's stats\n  weekly report          Weekly summary"}}
EOJSON
  exit 0
fi

echo '{}'
