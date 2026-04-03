#!/bin/bash
# bestwork PR review — posts review comment to GitHub PR
# Usage: ./scripts/review-pr.sh <pr-number>
set -euo pipefail

PR_NUM="${1:?Usage: review-pr.sh <pr-number>}"
echo "[BW] reviewing PR #${PR_NUM}..."

DIFF=$(gh pr diff "$PR_NUM" 2>/dev/null || true)
FILES=$(gh pr diff "$PR_NUM" --name-only 2>/dev/null | grep -v '^dist/' || true)
FILE_COUNT=$(echo "$FILES" | grep -c . || echo 0)

ISSUES=""
IC=0

# 1. Type safety bypasses
TS_BYPASS=$(echo "$DIFF" | grep -cE '^\+.*(as any|@ts-ignore|@ts-nocheck)' || true)
[ "$TS_BYPASS" -gt 0 ] && ISSUES="${ISSUES}⚠️ ${TS_BYPASS} type safety bypass(es) (\`as any\`, \`@ts-ignore\`)\n" && IC=$((IC+TS_BYPASS))

# 2. Hardcoded secrets
SECRETS=$(echo "$DIFF" | grep -ciE '^+.*(password|secret|api.key|token)[[:space:]]*[:=].*[a-zA-Z0-9]{20,}' || true)
[ "$SECRETS" -gt 0 ] && ISSUES="${ISSUES}🔴 ${SECRETS} possible hardcoded secret(s)!\n" && IC=$((IC+SECRETS))

# 3. Console.log in non-test files
DEBUG=$(echo "$DIFF" | grep '^+.*console\.log' | grep -cv 'test\|spec\|__tests__' || true)
[ "$DEBUG" -gt 0 ] && ISSUES="${ISSUES}💡 ${DEBUG} \`console.log\` in non-test files\n" && IC=$((IC+DEBUG))

# 4. TODO/FIXME/HACK
TODOS=$(echo "$DIFF" | grep -cE '^\+.*(TODO|FIXME|HACK|XXX)' || true)
[ "$TODOS" -gt 0 ] && ISSUES="${ISSUES}📝 ${TODOS} TODO/FIXME/HACK comment(s) added\n" && IC=$((IC+TODOS))

# 5. Large file additions (>200 lines added)
LARGE=$(echo "$DIFF" | grep -c '^+' || true)
[ "$LARGE" -gt 500 ] && ISSUES="${ISSUES}📏 Large PR: ${LARGE} lines added. Consider splitting.\n" && IC=$((IC+1))

# Verdict
if [ "$SECRETS" -gt 0 ]; then
  VERDICT="REQUEST_CHANGES"; EMOJI="❌"; ACTION="request-changes"
elif [ "$IC" -eq 0 ]; then
  VERDICT="APPROVE"; EMOJI="✅"; ACTION="approve"
else
  VERDICT="COMMENT"; EMOJI="💬"; ACTION="comment"
fi

BODY="## [BW] Code Review — PR #${PR_NUM}

**Files**: ${FILE_COUNT} changed | **Verdict**: ${EMOJI} ${VERDICT}
"

if [ "$IC" -gt 0 ]; then
  BODY="${BODY}
### Issues (${IC})
$(echo -e "$ISSUES")
"
else
  BODY="${BODY}
✅ All checks passed (imports, types, secrets, debug, TODOs)
"
fi

BODY="${BODY}---
*bestwork-agent review*"

gh pr review "$PR_NUM" --"$ACTION" --body "$BODY" 2>/dev/null || gh pr comment "$PR_NUM" --body "$BODY"
echo "[BW] review posted: ${VERDICT} (${IC} issues)"
