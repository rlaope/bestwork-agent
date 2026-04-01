import { formatDistanceToNow, format } from "date-fns";

export function relativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

export function shortDate(date: Date): string {
  return format(date, "MM/dd HH:mm");
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

export function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

export function barChart(value: number, max: number, width: number): string {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function shortSessionId(id: string): string {
  return id.slice(0, 8);
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}
