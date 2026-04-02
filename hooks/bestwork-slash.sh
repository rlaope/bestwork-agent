#!/bin/bash
# bestwork slash command handler
# Intercepts ./command patterns in Claude Code prompts

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .display // ""' 2>/dev/null)

# ./discord <webhook_url>
if echo "$PROMPT" | grep -qE '^\./discord'; then
  URL=$(echo "$PROMPT" | sed 's|^\./discord\s*||' | tr -d ' ')
  if [ -n "$URL" ]; then
    mkdir -p "$HOME/.bestwork"
    jq -n --arg url "$URL" '{"notify":{"discord":{"webhookUrl":$url}}}' > "$HOME/.bestwork/config.json"
    chmod 600 "$HOME/.bestwork/config.json"
    # Test notification
    curl -s -X POST "$URL" \
      -H "Content-Type: application/json" \
      -d '{"embeds":[{"title":"🔍 bestwork connected","description":"Discord notifications enabled. You will receive alerts after each prompt.","color":55467}]}' > /dev/null 2>&1
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[bestwork] Discord webhook configured and tested. Notifications will be sent after each prompt completion.\"}}"
  else
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[bestwork] Usage: ./discord <webhook_url>\"}}"
  fi
  exit 0
fi

# ./slack <webhook_url>
if echo "$PROMPT" | grep -qE '^\./slack'; then
  URL=$(echo "$PROMPT" | sed 's|^\./slack\s*||' | tr -d ' ')
  if [ -n "$URL" ]; then
    mkdir -p "$HOME/.bestwork"
    jq -n --arg url "$URL" '{"notify":{"slack":{"webhookUrl":$url}}}' > "$HOME/.bestwork/config.json"
    chmod 600 "$HOME/.bestwork/config.json"
    curl -s -X POST "$URL" \
      -H "Content-Type: application/json" \
      -d '{"blocks":[{"type":"header","text":{"type":"plain_text","text":"🔍 bestwork connected"}},{"type":"section","text":{"type":"mrkdwn","text":"Slack notifications enabled. You will receive alerts after each prompt."}}]}' > /dev/null 2>&1
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[bestwork] Slack webhook configured and tested. Notifications will be sent after each prompt completion.\"}}"
  else
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[bestwork] Usage: ./slack <webhook_url>\"}}"
  fi
  exit 0
fi

# ./bw-install — full setup
if echo "$PROMPT" | grep -qE '^\./bw-install'; then
  # Run base install
  INSTALL_RESULT=$(bestwork install 2>&1)

  # Parse optional flags
  EXTRA=""
  if echo "$PROMPT" | grep -qE '\-\-discord'; then
    DISCORD_URL=$(echo "$PROMPT" | grep -oE 'https://[^ ]+')
    if [ -n "$DISCORD_URL" ]; then
      mkdir -p "$HOME/.bestwork"
      jq -n --arg url "$DISCORD_URL" '{"notify":{"discord":{"webhookUrl":$url}}}' > "$HOME/.bestwork/config.json"
      chmod 600 "$HOME/.bestwork/config.json"
      EXTRA="${EXTRA}\nDiscord webhook configured."
    fi
  fi
  if echo "$PROMPT" | grep -qE '\-\-slack'; then
    SLACK_URL=$(echo "$PROMPT" | grep -oE 'https://[^ ]+')
    if [ -n "$SLACK_URL" ]; then
      mkdir -p "$HOME/.bestwork"
      jq -n --arg url "$SLACK_URL" '{"notify":{"slack":{"webhookUrl":$url}}}' > "$HOME/.bestwork/config.json"
      chmod 600 "$HOME/.bestwork/config.json"
      EXTRA="${EXTRA}\nSlack webhook configured."
    fi
  fi
  if echo "$PROMPT" | grep -qE '\-\-strict'; then
    mkdir -p "$HOME/.bestwork"
    echo "true" > "$HOME/.bestwork/strict.lock"
    EXTRA="${EXTRA}\nStrict mode enabled."
  fi
  if echo "$PROMPT" | grep -qE '\-\-scope'; then
    SCOPE_PATH=$(echo "$PROMPT" | sed 's|.*--scope\s*||' | awk '{print $1}')
    if [ -n "$SCOPE_PATH" ]; then
      mkdir -p "$HOME/.bestwork"
      echo "$SCOPE_PATH" > "$HOME/.bestwork/scope.lock"
      EXTRA="${EXTRA}\nScope locked to: ${SCOPE_PATH}"
    fi
  fi

  jq -n --arg result "${INSTALL_RESULT}${EXTRA}" \
    '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":("[bestwork install]\n" + $result)}}'
  exit 0
fi

# ./bestwork — status check
if echo "$PROMPT" | grep -qE '^\./bestwork'; then
  CONFIG=$(cat "$HOME/.bestwork/config.json" 2>/dev/null || echo '{}')
  HAS_DISCORD=$(echo "$CONFIG" | jq -r '.notify.discord.webhookUrl // empty')
  HAS_SLACK=$(echo "$CONFIG" | jq -r '.notify.slack.webhookUrl // empty')
  STATUS="bestwork status:\\n"
  [ -n "$HAS_DISCORD" ] && STATUS="${STATUS}  Discord: connected\\n" || STATUS="${STATUS}  Discord: not configured\\n"
  [ -n "$HAS_SLACK" ] && STATUS="${STATUS}  Slack: connected\\n" || STATUS="${STATUS}  Slack: not configured\\n"
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[bestwork] ${STATUS}\"}}"
  exit 0
fi

echo '{}'
