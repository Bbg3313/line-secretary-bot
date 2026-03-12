import type { ChatRow } from "./supabase";

/** created_at 기준 로컬 일자(YYYY-MM-DD) - 브라우저 시간대(한국 등) 기준 */
export function getDateKey(createdAt: string): string {
  try {
    const d = new Date(createdAt);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return createdAt.slice(0, 10);
  }
}

/** created_at 기준 로컬 시간 "HH:mm" */
export function getTimeStr(createdAt: string): string {
  try {
    const d = new Date(createdAt);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return createdAt.slice(11, 16) || "";
  }
}

/** 일자 라벨 "3월 12일 (목)" 형태 - 로컬 기준 */
export function getDateLabel(dateKey: string): string {
  try {
    const d = new Date(dateKey + "T12:00:00");
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const w = weekdays[d.getDay()];
    return `${month}월 ${day}일 (${w})`;
  } catch {
    return dateKey;
  }
}

/** 오늘 날짜 키 (YYYY-MM-DD) - 클라이언트에서 호출 시 로컬 기준 */
export function getTodayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 서버에서 사용: 한국 시간 기준 오늘 날짜 키 (YYYY-MM-DD) */
export function getTodayDateKeyKST(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date()).replace(/\//g, "-");
}

/** created_at을 한국 시간 기준 날짜 키(YYYY-MM-DD)로 변환 (서버/오늘 비교용) */
export function getDateKeyKST(createdAt: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date(createdAt)).replace(/\//g, "-");
  } catch {
    return createdAt.slice(0, 10);
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
