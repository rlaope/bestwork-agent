import React from "react";
import { Box, Text } from "ink";
import type { Session } from "../types/index.js";
import {
  shortDate,
  barChart,
  shortSessionId,
  formatNumber,
  relativeTime,
} from "../utils/format.js";

interface SessionDetailProps {
  session: Session;
}

export function SessionDetail({ session }: SessionDetailProps) {
  const toolEntries = Object.entries(session.toolCounts).sort(
    ([, a], [, b]) => b - a
  );
  const maxCount = toolEntries[0]?.[1] ?? 0;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text color="cyan" bold>[BW]</Text>
          <Text bold color="cyan">
            {" "}Session {shortSessionId(session.id)}
          </Text>
          {session.isActive && (
            <Text color="green" bold>
              {" "}● LIVE
            </Text>
          )}
        </Box>
        <Box>
          <Text color="gray">
            Started: {shortDate(session.startedAt)} ({relativeTime(session.startedAt)})
          </Text>
        </Box>
        {session.meta && (
          <Box>
            <Text color="gray">CWD: {session.meta.cwd}</Text>
          </Box>
        )}
        <Box>
          <Text color="gray">
            Total calls: {formatNumber(session.totalCalls)} • Prompts:{" "}
            {formatNumber(session.prompts.length)}
          </Text>
        </Box>
      </Box>

      {/* Tool Distribution */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Tool Usage</Text>
        <Box marginTop={1} flexDirection="column">
          {toolEntries.slice(0, 12).map(([tool, count]) => (
            <Box key={tool}>
              <Box width={18}>
                <Text>{tool}</Text>
              </Box>
              <Box width={25}>
                <Text color="cyan">{barChart(count, maxCount, 20)}</Text>
              </Box>
              <Box width={8}>
                <Text color="yellow">{formatNumber(count)}</Text>
              </Box>
              <Box>
                <Text color="gray">
                  ({((count / session.totalCalls) * 100).toFixed(1)}%)
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Subagents */}
      {session.subagents.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Subagents ({session.subagents.length})</Text>
          <Box marginTop={1} flexDirection="column">
            {session.subagents.map((agent) => (
              <Box key={agent.agentId}>
                <Text color="magenta">  ├─ </Text>
                <Text bold>{agent.agentType}</Text>
                <Text color="gray"> — {agent.description}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Recent Prompts */}
      {session.prompts.length > 0 && (
        <Box flexDirection="column">
          <Text bold>Recent Prompts</Text>
          <Box marginTop={1} flexDirection="column">
            {session.prompts.slice(-5).map((prompt, i) => (
              <Box key={i}>
                <Text color="gray">
                  {shortDate(new Date(prompt.timestamp))}{" "}
                </Text>
                <Text>
                  {prompt.display.length > 60
                    ? prompt.display.slice(0, 60) + "…"
                    : prompt.display}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
