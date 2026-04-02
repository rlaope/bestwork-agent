#!/bin/bash
# nysm smart gateway — unified router for all slash commands and natural language
# Replaces: nysm-gateway.sh, nysm-slash.sh, nysm-agents.sh, nysm-harness.sh, nysm-trio.sh, nysm-review.sh
# Single entry point for all UserPromptSubmit routing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .display // ""' 2>/dev/null)
LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# === TIER 1: Slash command prefix (exact match, highest priority) ===

# Setup commands
echo "$PROMPT" | grep -qE '^\./discord'  && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-slash.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./slack'    && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-slash.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./nysm'     && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-slash.sh" && exit 0

# Harness commands
echo "$PROMPT" | grep -qE '^\./scope'    && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./unlock'   && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./strict'   && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./relax'    && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./context'  && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./parallel' && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./tdd'      && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./recover'  && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-harness.sh" && exit 0

# Data-driven agents
echo "$PROMPT" | grep -qE '^\./autopsy'  && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-agents.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./similar'  && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-agents.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./learn'    && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-agents.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./predict'  && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-agents.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./guard'    && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-agents.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./compare'  && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-agents.sh" && exit 0

# Review & Trio
echo "$PROMPT" | grep -qE '^\./review'   && echo "$INPUT" | NYSM_REVIEW_TRIGGER=1 bash "$SCRIPT_DIR/nysm-review.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./trio'     && echo "$INPUT" | NYSM_TRIO_TRIGGER=1 bash "$SCRIPT_DIR/nysm-trio.sh" && exit 0

# Help
echo "$PROMPT" | grep -qE '^\./help'     && echo "$INPUT" | bash "$SCRIPT_DIR/nysm-agents.sh" && exit 0

# === TIER 2: Natural language routing (keyword scoring, bilingual) ===

# Review / hallucination check
if echo "$LOWER" | grep -qE '(리뷰|review|검증|verify|플랫폼|platform|할루시네이션|hallucination).*(코드|code|확인|check)'; then
  echo "$INPUT" | NYSM_REVIEW_TRIGGER=1 bash "$SCRIPT_DIR/nysm-review.sh"
  exit 0
fi

# Trio / parallel execution
if echo "$LOWER" | grep -qE '(병렬|parallel|동시|concurrent|trio).*(실행|run|돌|execute|작업|task)'; then
  echo "$INPUT" | NYSM_TRIO_TRIGGER=1 bash "$SCRIPT_DIR/nysm-trio.sh"
  exit 0
fi

# Autopsy / post-mortem
if echo "$LOWER" | grep -qE '(왜.*실패|why.*fail|분석|analyze|autopsy|post.?mortem|세션.*문제)'; then
  echo "$INPUT" | bash "$SCRIPT_DIR/nysm-agents.sh"
  exit 0
fi

# Learn / prompting advice
if echo "$LOWER" | grep -qE '(프롬프트|prompt).*(개선|improve|배우|learn|규칙|rule|팁|tip)'; then
  echo "$INPUT" | bash "$SCRIPT_DIR/nysm-agents.sh"
  exit 0
fi

# Predict / estimate
if echo "$LOWER" | grep -qE '(예측|predict|얼마나|how long|복잡도|complexity|걸릴|estimate)'; then
  echo "$INPUT" | bash "$SCRIPT_DIR/nysm-agents.sh"
  exit 0
fi

# Guard / health check
if echo "$LOWER" | grep -qE '(세션.*건강|session.*health|guard|괜찮|on track|궤도)'; then
  echo "$INPUT" | bash "$SCRIPT_DIR/nysm-agents.sh"
  exit 0
fi

# Scope / restrict
if echo "$LOWER" | grep -qE '(범위|scope|제한|restrict|잠금|lock).*(설정|set|폴더|dir|파일|file)'; then
  echo "$INPUT" | bash "$SCRIPT_DIR/nysm-harness.sh"
  exit 0
fi

# TDD
if echo "$LOWER" | grep -qE '(tdd|테스트.*먼저|test.*first|테스트.*주도)'; then
  echo "$INPUT" | bash "$SCRIPT_DIR/nysm-harness.sh"
  exit 0
fi

# Loop detection
if echo "$LOWER" | grep -qE '(loop|루프).*(detect|감지|check|찾)'; then
  RESULT=$(nysm loops 2>&1)
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm loop detection]\\n${RESULT}\"}}"
  exit 0
fi

# Heatmap
if echo "$LOWER" | grep -qE '(heatmap|히트맵|activity|활동).*(show|보여|view)'; then
  RESULT=$(nysm heatmap 2>&1)
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm heatmap]\\n${RESULT}\"}}"
  exit 0
fi

# Summary
if echo "$LOWER" | grep -qE '(session|세션).*(summary|요약|stats|통계)'; then
  RESULT=$(nysm summary 2>&1)
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm summary]\\n${RESULT}\"}}"
  exit 0
fi

# Weekly
if echo "$LOWER" | grep -qE '(weekly|주간).*(summary|report|요약|리포트)'; then
  RESULT=$(nysm summary -w 2>&1)
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm weekly]\\n${RESULT}\"}}"
  exit 0
fi

# No match
echo '{}'
