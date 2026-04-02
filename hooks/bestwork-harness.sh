#!/bin/bash
# bestwork harness — active development acceleration hooks
# These don't analyze — they INTERVENE to make coding faster

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .display // ""' 2>/dev/null)

# --- ./scope <path> — lock agent to specific directories ---
# Prevents the agent from touching files outside scope
if echo "$PROMPT" | grep -qE '^\./scope'; then
  SCOPE=$(echo "$PROMPT" | sed 's|^\./scope\s*||')
  if [ -n "$SCOPE" ]; then
    mkdir -p "$HOME/.bestwork"
    echo "$SCOPE" > "$HOME/.bestwork/scope.lock"
    cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork harness: scope locked]\nScope restricted to: ${SCOPE}\nDo NOT modify any files outside this scope. If you need to read files outside scope, that's fine. But all Edit/Write operations must target files within: ${SCOPE}\nTo unlock: ./unlock"}}
EOJSON
  else
    cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork harness] Usage: ./scope src/auth/ — restricts edits to that directory"}}
EOJSON
  fi
  exit 0
fi

# --- ./unlock — remove scope lock ---
if echo "$PROMPT" | grep -qE '^\./unlock'; then
  rm -f "$HOME/.bestwork/scope.lock"
  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork harness: scope unlocked] No restrictions on file modifications."}}
EOJSON
  exit 0
fi

# --- ./strict — enable all guardrails at once ---
if echo "$PROMPT" | grep -qE '^\./strict'; then
  mkdir -p "$HOME/.bestwork"
  echo "true" > "$HOME/.bestwork/strict.lock"
  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork harness: strict mode ON]\nAll guardrails activated:\n1. Read before Edit — must read every file before modifying\n2. Auto typecheck — runs after every code change\n3. Test on change — runs relevant tests after edits\n4. No force operations — git push --force, rm -rf blocked\n\nThese rules are MANDATORY until ./relax is called."}}
EOJSON
  exit 0
fi

# --- ./relax — disable strict mode ---
if echo "$PROMPT" | grep -qE '^\./relax'; then
  rm -f "$HOME/.bestwork/strict.lock"
  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork harness: strict mode OFF] Guardrails relaxed."}}
EOJSON
  exit 0
fi

# --- ./context <files...> — preload files into agent context ---
if echo "$PROMPT" | grep -qE '^\./context'; then
  FILES=$(echo "$PROMPT" | sed 's|^\./context\s*||')
  if [ -z "$FILES" ]; then
    # Auto-detect: recently changed files + their imports
    FILES=$(git diff --name-only HEAD 2>/dev/null | head -10)
    [ -z "$FILES" ] && FILES=$(git diff --name-only 2>/dev/null | head -10)
  fi

  CONTENT=""
  for f in $FILES; do
    if [ -f "$f" ]; then
      CONTENT="${CONTENT}\n--- ${f} ---\n$(head -50 "$f" 2>/dev/null)\n"
    fi
  done

  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork harness: context preloaded]\nRead these files before proceeding with any task:\n${CONTENT}\n\nThese files are preloaded because they are relevant to the current work. Reference them directly instead of reading again."}}
EOJSON
  exit 0
fi

# --- ./parallel <task1> | <task2> | <task3> — parallel task execution ---
if echo "$PROMPT" | grep -qE '^\./parallel'; then
  TASKS=$(echo "$PROMPT" | sed 's|^\./parallel\s*||')

  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork harness: parallel execution]\nSplit these tasks and execute them simultaneously using Agent tool with run_in_background:\n\n${TASKS}\n\nRules:\n1. Each task delimited by | runs as an independent Agent\n2. No task should depend on another task's output\n3. Each agent gets its own worktree if modifying files\n4. Merge results after all agents complete\n5. Run tests after merging to catch conflicts"}}
EOJSON
  exit 0
fi

# --- ./tdd <description> — test-driven development flow ---
if echo "$PROMPT" | grep -qE '^\./tdd'; then
  DESC=$(echo "$PROMPT" | sed 's|^\./tdd\s*||')

  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork harness: TDD mode]\nTask: ${DESC}\n\nFollow strict TDD workflow:\n1. Write the test FIRST — define expected behavior\n2. Run test — confirm it FAILS (red)\n3. Write minimal code to make the test pass (green)\n4. Run test — confirm it PASSES\n5. Refactor if needed — keep tests passing\n6. Repeat for next requirement\n\nDo NOT write implementation before tests. Do NOT skip the red step."}}
EOJSON
  exit 0
fi

# --- ./recover — when stuck, reset approach ---
if echo "$PROMPT" | grep -qE '^\./recover'; then
  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[bestwork harness: recovery mode]\nThe current approach isn't working. Reset and try differently.\n\nRecovery steps:\n1. STOP what you're doing\n2. Read the error/failure output carefully\n3. Identify what assumption was wrong\n4. Try a completely different approach — not a variation of the same thing\n5. If editing the same file repeatedly, step back and read related files first\n6. Consider: is the task scoped correctly? Should it be broken down?"}}
EOJSON
  exit 0
fi

echo '{}'
