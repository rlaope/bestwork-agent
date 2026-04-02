import React from "react";
import { Box, Text } from "ink";

export function Banner({ subtitle }: { subtitle?: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan" bold>
        {"  ██████╗ ██╗    ██╗"}
      </Text>
      <Text color="cyan" bold>
        {"  ██╔══██╗██║    ██║"}
      </Text>
      <Text color="cyan" bold>
        {"  ██████╔╝██║ █╗ ██║"}
      </Text>
      <Text color="cyan" bold>
        {"  ██╔══██╗██║███╗██║"}
      </Text>
      <Text color="cyan" bold>
        {"  ██████╔╝╚███╔███╔╝"}
      </Text>
      <Text color="cyan" bold>
        {"  ╚═════╝  ╚══╝╚══╝ "}
        <Text color="gray">bestwork-agent</Text>
      </Text>
      {subtitle && (
        <Text color="gray">  {subtitle}</Text>
      )}
    </Box>
  );
}
