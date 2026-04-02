import React from "react";
import { Box, Text } from "ink";
import type { Session } from "../types/index.js";
import { relativeTime, shortSessionId, formatNumber, truncate } from "../utils/format.js";

interface SessionListProps {
  sessions: Session[];
  selectedIndex: number;
  totalCalls: number;
}

export function SessionList({ sessions, selectedIndex, totalCalls }: SessionListProps) {
  const visibleCount = 12;
  const start = Math.max(0, selectedIndex - Math.floor(visibleCount / 2));
  const visible = sessions.slice(start, start + visibleCount);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>
          Sessions ({sessions.length} total)
        </Text>
      </Box>

      {visible.map((session, i) => {
        const globalIndex = start + i;
        const isSelected = globalIndex === selectedIndex;
        const lastPrompt = session.prompts[session.prompts.length - 1];
        const cwd = session.meta?.cwd ?? "";
        const cwdShort = cwd
          ? cwd.split("/").slice(-2).join("/")
          : "";
        const promptText = lastPrompt
          ? truncate(lastPrompt.display, 40)
          : "";
        const pct = totalCalls > 0
          ? ((session.totalCalls / totalCalls) * 100).toFixed(1)
          : "0";

        return (
          <Box key={session.id}>
            <Text color={isSelected ? "cyan" : "gray"}>
              {isSelected ? "▸ " : "  "}
            </Text>
            <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
              {shortSessionId(session.id)}
            </Text>
            {session.isActive ? (
              <Text color="green" bold> ●</Text>
            ) : (
              <Text color="gray"> ○</Text>
            )}
            <Text color="yellow"> {formatNumber(session.totalCalls)}</Text>
            <Text color="magenta"> {pct.padStart(5)}%</Text>
            <Text color="gray"> {relativeTime(session.startedAt).padEnd(18)}</Text>
            {cwdShort ? (
              <Text color="blue"> {cwdShort}</Text>
            ) : null}
            {promptText ? (
              <Text color="gray"> 💬 {promptText}</Text>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
