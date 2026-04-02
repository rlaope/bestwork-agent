import React, { useState, useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { aggregateSessions } from "../observe/aggregator.js";
import { saveConfig, loadConfig, sendNotification } from "../harness/notify.js";
import { shortSessionId, relativeTime, formatNumber } from "../utils/format.js";
import type { Session } from "../types/index.js";

type Step = "select" | "webhook" | "watching";

export function WatchSetup() {
  const { exit } = useApp();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [step, setStep] = useState<Step>("select");
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set()
  );
  const [cursorIndex, setCursorIndex] = useState(0);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookType, setWebhookType] = useState<"discord" | "slack">(
    "discord"
  );
  const [typeSelectIndex, setTypeSelectIndex] = useState(0);
  const [watching, setWatching] = useState(false);
  const [lastCheck, setLastCheck] = useState("");

  useEffect(() => {
    aggregateSessions().then((s) => {
      const active = s.filter((sess) => sess.isActive);
      setSessions(active.length > 0 ? active : s.slice(0, 10));
    });
  }, []);

  useEffect(() => {
    if (!watching) return;

    const interval = setInterval(async () => {
      const current = await aggregateSessions();
      const watchedIds = [...selectedIndices].map(
        (i) => sessions[i]?.id
      );

      for (const id of watchedIds) {
        if (!id) continue;
        const session = current.find((s) => s.id === id);
        if (session && !session.isActive) {
          const summary = [
            `Session \`${shortSessionId(id)}\` completed.`,
            `Total calls: ${formatNumber(session.totalCalls)}`,
            `Last tool: ${session.lastTool}`,
            `Prompts: ${formatNumber(session.prompts.length)}`,
          ].join("\n");

          await sendNotification("Session Complete", summary);
          setLastCheck(`Notified: ${shortSessionId(id)} completed`);
        }
      }
      setLastCheck(
        `Last check: ${new Date().toLocaleTimeString()}`
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [watching, selectedIndices, sessions]);

  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }

    if (step === "select") {
      if (key.upArrow) {
        setCursorIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setCursorIndex((i) => Math.min(sessions.length - 1, i + 1));
      } else if (input === " ") {
        setSelectedIndices((prev) => {
          const next = new Set(prev);
          if (next.has(cursorIndex)) next.delete(cursorIndex);
          else next.add(cursorIndex);
          return next;
        });
      } else if (key.return && selectedIndices.size > 0) {
        setStep("webhook");
      }
    } else if (step === "webhook") {
      if (key.upArrow || key.downArrow) {
        setTypeSelectIndex((i) => (i === 0 ? 1 : 0));
      } else if (key.return) {
        setWebhookType(typeSelectIndex === 0 ? "discord" : "slack");
        setStep("watching");
        // Save config and start watching
        (async () => {
          const config = await loadConfig();
          if (typeSelectIndex === 0) {
            config.notify.discord = { webhookUrl };
          } else {
            config.notify.slack = { webhookUrl };
          }
          await saveConfig(config);
          setWatching(true);
        })();
      } else if (key.backspace || key.delete) {
        setWebhookUrl((prev) => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setWebhookUrl((prev) => prev + input);
      }
    }
  });

  if (sessions.length === 0) {
    return (
      <Box padding={1}>
        <Text color="yellow">Loading sessions...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          bestwork watch
        </Text>
        <Text color="gray"> — session end notifications</Text>
      </Box>

      {step === "select" && (
        <Box flexDirection="column">
          <Text bold>Select sessions to watch (Space to toggle, Enter to confirm)</Text>
          <Box marginTop={1} flexDirection="column">
            {sessions.map((session, i) => {
              const isSelected = selectedIndices.has(i);
              const isCursor = i === cursorIndex;

              return (
                <Box key={session.id}>
                  <Text color={isCursor ? "cyan" : "white"}>
                    {isCursor ? "▸" : " "}{" "}
                    {isSelected ? "[✓]" : "[ ]"}{" "}
                  </Text>
                  <Text color={isSelected ? "green" : "white"} bold={isSelected}>
                    {shortSessionId(session.id)}
                  </Text>
                  <Text color="gray">
                    {"  "}{relativeTime(session.startedAt)}
                    {"  "}{formatNumber(session.totalCalls)} calls
                    {"  "}{session.isActive ? "\x1b[32m● live\x1b[0m" : "○ done"}
                  </Text>
                </Box>
              );
            })}
          </Box>
          <Box marginTop={1}>
            <Text color="gray">
              {selectedIndices.size} selected
            </Text>
          </Box>
        </Box>
      )}

      {step === "webhook" && (
        <Box flexDirection="column">
          <Text bold>Enter webhook URL:</Text>
          <Box marginTop={1}>
            <Text color="cyan">{webhookUrl || "paste URL here..."}</Text>
            <Text color="gray">█</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text bold>Platform:</Text>
            <Text color={typeSelectIndex === 0 ? "cyan" : "gray"}>
              {typeSelectIndex === 0 ? "▸" : " "} Discord
            </Text>
            <Text color={typeSelectIndex === 1 ? "cyan" : "gray"}>
              {typeSelectIndex === 1 ? "▸" : " "} Slack
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">Enter to confirm</Text>
          </Box>
        </Box>
      )}

      {step === "watching" && (
        <Box flexDirection="column">
          <Text color="green" bold>
            Watching {selectedIndices.size} session(s)...
          </Text>
          <Box marginTop={1} flexDirection="column">
            {[...selectedIndices].map((i) => {
              const s = sessions[i];
              if (!s) return null;
              return (
                <Text key={s.id} color="cyan">
                  • {shortSessionId(s.id)} — {s.isActive ? "● live" : "○ done"}
                </Text>
              );
            })}
          </Box>
          <Box marginTop={1}>
            <Text color="gray">{lastCheck}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">
              Notifications → {webhookType} • Checking every 5s • Esc to stop
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
