import type { ChatRow } from "./supabase";

/** created_at 기준 일자(YYYY-MM-DD) */
export function getDateKey(createdAt: string): string {
  try {
    const d = new Date(createdAt);
    return d.toISOString().slice(0, 10);
  } catch {
    return createdAt.slice(0, 10);
  }
}

/** created_at 기준 시간 "HH:mm" */
export function getTimeStr(createdAt: string): string {
  try {
    const d = new Date(createdAt);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return createdAt.slice(11, 16) || "";
  }
}

/** 일자 라벨 "3월 12일 (목)" 형태 */
export function getDateLabel(dateKey: string): string {
  try {
    const d = new Date(dateKey + "Z");
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const w = weekdays[d.getUTCDay()];
    return `${month}월 ${day}일 (${w})`;
  } catch {
    return dateKey;
  }
}

/** 일정 목록을 일자별로 묶고, 일자·시간 순 정렬 (오래된 일자 먼저, 같은 일자면 시간 순) */
export function groupScheduleByDate(chats: ChatRow[]): { dateKey: string; dateLabel: string; items: ChatRow[] }[] {
  const sorted = [...chats].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const byDate = new Map<string, ChatRow[]>();
  for (const chat of sorted) {
    const key = getDateKey(chat.created_at);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(chat);
  }
  const keys = Array.from(byDate.keys()).sort();
  return keys.map((dateKey) => ({
    dateKey,
    dateLabel: getDateLabel(dateKey),
    items: byDate.get(dateKey) ?? [],
  }));
}
