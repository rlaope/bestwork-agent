#!/bin/bash
# bestwork trio — parallel task execution with Tech + PM + Critic per task
# Each task gets 3 agents: developer, product manager, critic

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .display // ""' 2>/dev/null)

if ! echo "$PROMPT" | grep -qE '^\./trio' && [ "$BESTWORK_TRIO_TRIGGER" != "1" ]; then
  echo '{}'
  exit 0
fi

TASKS_RAW=$(echo "$PROMPT" | sed 's|^\./trio\s*||')

# Read env for review context
OS=$(uname -s)
ARCH=$(uname -m)
NODE_VER=$(node -v 2>/dev/null || echo "unknown")

# Build the trio execution prompt
cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork trio: parallel execution with quality gates]\n\nTasks to execute in parallel: ${TASKS_RAW}\n\nSplit by | delimiter. For EACH task, execute this pipeline:\n\n## Execution Model (per task)\n\n### Step 1: Tech Agent (Developer)\nSpawn an Agent with run_in_background for each task:\n- Implement the task fully\n- Write tests\n- Run tests to verify\n\n### Step 2: PM Agent (Product Manager)\nAfter Tech completes, spawn a review Agent:\n- Does the implementation meet the original requirement?\n- Is anything missing or over-engineered?\n- Are edge cases handled?\n- Verdict: APPROVE or REQUEST_CHANGES with specific feedback\n\n### Step 3: Critic Agent (Quality & Anti-Hallucination)\nAfter Tech completes, spawn a review Agent:\n- Code quality: duplication, complexity, naming\n- Platform check: is the code correct for ${OS} ${ARCH} Node ${NODE_VER}?\n- Hallucination check: do all imports exist? Are APIs real? Do file paths exist?\n- Test coverage: are tests meaningful or trivial?\n- Verdict: APPROVE or REQUEST_CHANGES with specific feedback\n\n### Step 4: Feedback Loop\nIf PM or Critic rejected:\n- Feed their specific feedback back to Tech\n- Tech fixes the issues\n- PM and Critic re-review\n- Max 3 iterations per task\n\n### Step 5: Merge & Final Check\nAfter all parallel tasks complete:\n- Merge results\n- Run full test suite\n- Check for conflicts between parallel changes\n\n## Rules\n- Each task is INDEPENDENT — no shared state between parallel tasks\n- Tech must READ files before editing (grounding)\n- Critic must verify imports and APIs actually exist (anti-hallucination)\n- PM focuses on WHAT, Critic focuses on HOW\n- If a task fails 3 iterations, report it and move on\n\n## Feedback Loop Threshold\nAfter ALL tasks complete, evaluate session health:\n- If >30% of tasks needed Critic fixes → trigger full session review\n- If >50% had hallucination issues → flag for user attention\n- Otherwise, proceed normally\n\nStart execution now. Launch all Tech agents in parallel."}}
EOJSON
