export interface ToolCounts {
  [toolName: string]: number;
}

export interface RawSessionStat {
  tool_counts: ToolCounts;
  last_tool: string;
  total_calls: number;
  started_at: number;
  updated_at: number;
}

export interface RawSessionStats {
  sessions: Record<string, RawSessionStat>;
}

export interface HistoryEntry {
  display: string;
  pastedContents?: Record<string, string>;
  timestamp: number;
  project: string;
  sessionId: string;
}

export interface SessionMeta {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint?: string;
}

export interface SubagentMeta {
  agentType: string;
  description: string;
  sessionId: string;
  agentId: string;
}

export interface Session {
  id: string;
  startedAt: Date;
  updatedAt: Date;
  toolCounts: ToolCounts;
  totalCalls: number;
  lastTool: string;
  prompts: HistoryEntry[];
  meta: SessionMeta | null;
  subagents: SubagentMeta[];
  isActive: boolean;
}

export interface ToolRank {
  name: string;
  count: number;
  percentage: number;
}

export interface DailySummary {
  date: string;
  totalSessions: number;
  totalCalls: number;
  totalPrompts: number;
  topTool: string;
  topToolCount: number;
  toolRanking: ToolRank[];
}

// ============================================================
// Context Accumulation Types
// ============================================================

export interface Decision {
  title: string;
  text: string;
  reason: string;
  impact: string;
  date?: string;
}

export interface ContextEntry {
  date: string;
  title: string;
  keywords: string[];
  file: string;
  line: number;
}

export interface ContextIndex {
  entries: ContextEntry[];
}

// ============================================================
// Agent Scoring Types
// ============================================================

export interface AgentRun {
  agent: string;
  task: string;
  duration: number;
  success: boolean;
  retries: number;
  timestamp: string;
}

export interface AgentScore {
  agent: string;
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  avgRetries: number;
  lastRun: string;
  effectiveness: number;
}

// ============================================================
// Token ROI Types
// ============================================================

export interface TokenUsage {
  skill: string;
  agent: string;
  tokens: number;
  tasksCompleted: number;
  timestamp: string;
}

export interface TokenStats {
  skill: string;
  totalTokens: number;
  totalTasks: number;
  avgTokensPerTask: number;
}

export interface AgentTokenStats {
  agent: string;
  totalTokens: number;
  totalTasks: number;
  avgTokensPerTask: number;
}

export interface ROIResult {
  skill: string;
  tokensPerTask: number;
  roi: number;
}
