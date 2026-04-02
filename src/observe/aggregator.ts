import { format, startOfDay, subDays, isAfter } from "date-fns";
import {
  parseSessionStats,
  parseHistory,
  parseSessions,
  parseSubagents,
} from "../data/claude-parser.js";
import type {
  Session,
  ToolRank,
  DailySummary,
  ToolCounts,
  HistoryEntry,
  SessionMeta,
  SubagentMeta,
} from "../types/index.js";

export async function aggregateSessions(): Promise<Session[]> {
  const [statsMap, history, metas, subagents] = await Promise.all([
    parseSessionStats(),
    parseHistory(),
    parseSessions(),
    parseSubagents(),
  ]);

  const historyBySession = groupBy(history, (h) => h.sessionId);
  const metaBySession = new Map(metas.map((m) => [m.sessionId, m]));
  const subagentsBySession = groupBy(subagents, (s) => s.sessionId);
  const activePids = new Set(metas.map((m) => m.pid));

  const sessions: Session[] = [];

  for (const [id, stat] of statsMap) {
    const meta = metaBySession.get(id) ?? null;
    const isActive = meta ? activePids.has(meta.pid) : false;

    sessions.push({
      id,
      startedAt: new Date(toMillis(stat.started_at)),
      updatedAt: new Date(toMillis(stat.updated_at)),
      toolCounts: stat.tool_counts,
      totalCalls: stat.total_calls,
      lastTool: stat.last_tool,
      prompts: historyBySession.get(id) ?? [],
      meta,
      subagents: subagentsBySession.get(id) ?? [],
      isActive,
    });
  }

  // Sort by most recent first
  sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  return sessions;
}

export function getToolRanking(sessions: Session[]): ToolRank[] {
  const totals: ToolCounts = {};

  for (const session of sessions) {
    for (const [tool, count] of Object.entries(session.toolCounts)) {
      totals[tool] = (totals[tool] ?? 0) + count;
    }
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return Object.entries(totals)
    .map(([name, count]) => ({
      name,
      count,
      percentage: grandTotal > 0 ? (count / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function getDailySummary(
  sessions: Session[],
  date: Date = new Date()
): DailySummary {
  const dayStr = format(date, "yyyy-MM-dd");
  const dayStart = startOfDay(date);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const daySessions = sessions.filter(
    (s) => s.startedAt >= dayStart && s.startedAt < dayEnd
  );

  const totalCalls = daySessions.reduce((sum, s) => sum + s.totalCalls, 0);
  const totalPrompts = daySessions.reduce(
    (sum, s) => sum + s.prompts.length,
    0
  );
  const toolRanking = getToolRanking(daySessions);
  const topTool = toolRanking[0];

  return {
    date: dayStr,
    totalSessions: daySessions.length,
    totalCalls,
    totalPrompts,
    topTool: topTool?.name ?? "N/A",
    topToolCount: topTool?.count ?? 0,
    toolRanking,
  };
}

export function getWeeklySummary(sessions: Session[]): DailySummary[] {
  const today = new Date();
  const summaries: DailySummary[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = subDays(today, i);
    summaries.push(getDailySummary(sessions, date));
  }

  return summaries;
}

/** Detect whether a timestamp is in seconds or milliseconds and normalize to ms */
function toMillis(ts: number): number {
  // If ts < 1e12, it's in seconds (before ~2001 in ms, but valid as seconds until ~2286)
  return ts < 1e12 ? ts * 1000 : ts;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) {
      group.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}
