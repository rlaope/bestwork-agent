#!/bin/bash
# bestwork smart gateway — unified router for all slash commands and natural language
# Replaces: bestwork-gateway.sh, bestwork-slash.sh, bestwork-agents.sh, bestwork-harness.sh, bestwork-trio.sh, bestwork-review.sh
# Single entry point for all UserPromptSubmit routing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .display // ""' 2>/dev/null)
LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# === TIER 1: Slash command prefix (exact match, highest priority) ===

# Setup commands
echo "$PROMPT" | grep -qE '^\./bw-install' && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-slash.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./discord'    && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-slash.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./slack'      && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-slash.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./bestwork'   && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-slash.sh" && exit 0

# Harness commands
echo "$PROMPT" | grep -qE '^\./scope'    && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./unlock'   && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./strict'   && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./relax'    && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./context'  && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./parallel' && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./tdd'      && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-harness.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./recover'  && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-harness.sh" && exit 0

# Data-driven agents
echo "$PROMPT" | grep -qE '^\./autopsy'  && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-agents.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./similar'  && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-agents.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./learn'    && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-agents.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./predict'  && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-agents.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./guard'    && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-agents.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./compare'  && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-agents.sh" && exit 0

# Review & Trio
echo "$PROMPT" | grep -qE '^\./review'   && echo "$INPUT" | BESTWORK_REVIEW_TRIGGER=1 bash "$SCRIPT_DIR/bestwork-review.sh" && exit 0
echo "$PROMPT" | grep -qE '^\./trio'     && echo "$INPUT" | BESTWORK_TRIO_TRIGGER=1 bash "$SCRIPT_DIR/bestwork-trio.sh" && exit 0

# Help
echo "$PROMPT" | grep -qE '^\./help'     && echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-agents.sh" && exit 0

# === TIER 2: Skill routing (analyze prompt → invoke plugin skill) ===
# Output additionalContext that tells Claude to invoke the matched skill

route_skill() {
  local SKILL_NAME="$1"
  local REASON="$2"
  jq -n --arg skill "$SKILL_NAME" --arg reason "$REASON" \
    '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":("[BW gateway] matched skill: bestwork-agent:" + $skill + " — " + $reason + ". Use the Skill tool to invoke bestwork-agent:" + $skill + " now.")}}'
  exit 0
}

# Review / hallucination check
if echo "$LOWER" | grep -qE '(리뷰|review|검증|verify|할루시네이션|hallucination|검사|scan)'; then
  route_skill "review" "code review and hallucination scan requested"
fi

# Trio / parallel execution
if echo "$LOWER" | grep -qE '(병렬|parallel|동시|concurrent|trio)'; then
  route_skill "trio" "parallel trio execution requested"
fi

# Health check
if echo "$LOWER" | grep -qE '(health|건강|상태.*체크|상태.*확인|괜찮|on track)'; then
  route_skill "health" "session health check requested"
fi

# Agents list
if echo "$LOWER" | grep -qE '(에이전트.*목록|에이전트.*리스트|agent.*list|agents|프로필)'; then
  route_skill "agents" "agent catalog requested"
fi

# Session stats
if echo "$LOWER" | grep -qE '(session|세션).*(summary|요약|stats|통계|list|목록)'; then
  route_skill "sessions" "session list requested"
fi

# Changelog
if echo "$LOWER" | grep -qE '(changelog|변경.*로그|변경.*이력|릴리즈.*노트)'; then
  route_skill "changelog" "changelog generation requested"
fi

# Status
if echo "$LOWER" | grep -qE '(bestwork|bw).*(status|상태|설정|config)'; then
  route_skill "status" "configuration status requested"
fi

# Onboard
if echo "$LOWER" | grep -qE '(onboard|온보딩|시작.*가이드|setup.*guide|처음)'; then
  route_skill "onboard" "onboarding guide requested"
fi

# Update
if echo "$LOWER" | grep -qE '(update|업데이트|업그레이드|upgrade).*(bestwork|bw|플러그인|plugin)'; then
  route_skill "update" "update check requested"
fi

# Install
if echo "$LOWER" | grep -qE '(install|설치|인스톨).*(hook|훅|bestwork|bw)'; then
  route_skill "install" "hook installation requested"
fi

# === TIER 3: CLI command routing (bestwork CLI tools) ===

# Loop detection
if echo "$LOWER" | grep -qE '(loop|루프).*(detect|감지|check|찾)'; then
  RESULT=$(bestwork loops 2>&1)
  jq -n --arg result "[BW loops]\n$RESULT" \
    '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":$result}}'
  exit 0
fi

# Heatmap
if echo "$LOWER" | grep -qE '(heatmap|히트맵|activity|활동).*(show|보여|view)'; then
  RESULT=$(bestwork heatmap 2>&1)
  jq -n --arg result "[BW heatmap]\n$RESULT" \
    '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":$result}}'
  exit 0
fi

# Weekly
if echo "$LOWER" | grep -qE '(weekly|주간).*(summary|report|요약|리포트)'; then
  RESULT=$(bestwork summary -w 2>&1)
  jq -n --arg result "[BW weekly]\n$RESULT" \
    '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":$result}}'
  exit 0
fi

# Autopsy / post-mortem
if echo "$LOWER" | grep -qE '(왜.*실패|why.*fail|autopsy|post.?mortem)'; then
  echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-agents.sh"
  exit 0
fi

# Scope / restrict
if echo "$LOWER" | grep -qE '(범위|scope|제한|restrict|잠금|lock).*(설정|set|폴더|dir|파일|file)'; then
  echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-harness.sh"
  exit 0
fi

# TDD
if echo "$LOWER" | grep -qE '(tdd|테스트.*먼저|test.*first|테스트.*주도)'; then
  echo "$INPUT" | bash "$SCRIPT_DIR/bestwork-harness.sh"
  exit 0
fi

# No match
echo '{}'
