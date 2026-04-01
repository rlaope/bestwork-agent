export interface ToolEvent {
  timestamp: number;
  sessionId: string;
  toolName: string;
  event: "pre" | "post" | "fail";
  input?: {
    file_path?: string;
    command?: string;
    pattern?: string;
    content?: string;
    [key: string]: unknown;
  };
  output?: {
    success?: boolean;
    filePath?: string;
    [key: string]: unknown;
  };
  durationMs?: number;
}

export interface SessionEvent {
  timestamp: number;
  sessionId: string;
  event: "start" | "end";
  cwd?: string;
}

export type NysmEvent = ToolEvent | SessionEvent;

export interface LoopPattern {
  sessionId: string;
  tool: string;
  file: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  windowMs: number;
}
