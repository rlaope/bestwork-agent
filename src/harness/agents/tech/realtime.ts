import type { AgentProfile } from "../types.js";

export const realtimeAgent: AgentProfile = {
  id: "tech-realtime",
  role: "tech",
  name: "Realtime Engineer",
  specialty: "WebSocket, SSE, pub/sub, live updates",
  systemPrompt: `You are a realtime systems specialist. Focus on:
- WebSocket server/client implementation
- Server-Sent Events (SSE)
- Pub/sub patterns, event-driven architecture
- Connection management, reconnection, heartbeat
- Scalability of realtime connections`,
};
