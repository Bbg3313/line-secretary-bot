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

/** 상태값을 '지시 대기' | '지시 완료' 로만 통일 (카운트·필터 공통) */
export function normalizeTaskStatus(status: string | null | undefined): "지시 대기" | "지시 완료" {
  const s = (status ?? "").trim();
  if (s === "지시 완료" || s === "완료" || s === "done") return "지시 완료";
  return "지시 대기";
}

/** 담당자 문자열이 '지정됨'(미정 아님)인지 */
export function isAssigneeAssigned(assignee: string | null | undefined): boolean {
  const a = (assignee ?? "").trim();
  return a.length > 0 && a !== "미정";
}

/** 마감일(deadline)이 오늘(한국 시간)인지 여부 */
export function isDeadlineTodayKST(deadline: string | null): boolean {
  if (!deadline || !deadline.trim()) return false;
  return getDateKeyKST(deadline) === getTodayDateKeyKST();
}

/** 한국 시간 기준으로 마감일까지 남은 일수 (오늘=0, 내일=1). 계산 실패 시 null */
export function daysUntilDeadlineKST(deadline: string | null): number | null {
  if (!deadline || !deadline.trim()) return null;
  try {
    const dKey = getDateKeyKST(deadline);
    const tKey = getTodayDateKeyKST();
    const d = new Date(dKey + "T00:00:00+09:00");
    const t = new Date(tKey + "T00:00:00+09:00");
    const diffMs = d.getTime() - t.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/** 마감일이 오늘이거나 이미 지난 날(지연)인지. 기한 없음은 false */
export function isDeadlineTodayOrPastKST(deadline: string | null): boolean {
  if (!deadline || !deadline.trim()) return false;
  const todayKey = getTodayDateKeyKST();
  return getDateKeyKST(deadline) <= todayKey;
}

/** 마감일이 오늘보다 과거인지(지연). 오늘/미래/기한없음은 false */
export function isDeadlineOverdueKST(deadline: string | null): boolean {
  if (!deadline || !deadline.trim()) return false;
  const todayKey = getTodayDateKeyKST();
  return getDateKeyKST(deadline) < todayKey;
}

/** 내일 날짜 키 (YYYY-MM-DD) - 한국 시간 기준 */
export function getTomorrowDateKeyKST(): string {
  const todayKey = getTodayDateKeyKST();
  const d = new Date(todayKey + "T12:00:00+09:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** 마감일이 내일(한국 시간)인지 여부 */
export function isDeadlineTomorrowKST(deadline: string | null): boolean {
  if (!deadline || !deadline.trim()) return false;
  return getDateKeyKST(deadline) === getTomorrowDateKeyKST();
}

/** 마감이 오늘은 아니지만 N일 이내(1~N일)로 촉박한지 여부 */
export function isDeadlineSoonKST(deadline: string | null, days: number = 2): boolean {
  const d = daysUntilDeadlineKST(deadline);
  if (d === null) return false;
  return d > 0 && d <= days;
}

/** 마감일 포맷 "03/14 (토)" - 한국 시간, 대시보드 표시용 */
export function formatDeadlineWithWeekday(deadline: string | null): string {
  if (!deadline || !deadline.trim()) return "";
  try {
    const d = new Date(deadline);
    const opts: Intl.DateTimeFormatOptions = { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" };
    const parts = new Intl.DateTimeFormat("ko-KR", opts).formatToParts(d);
    let month = "";
    let day = "";
    for (const p of parts) {
      if (p.type === "month") month = p.value.padStart(2, "0");
      if (p.type === "day") day = p.value.padStart(2, "0");
    }
    const w = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" }).format(d);
    return `${month}/${day} (${w})`;
  } catch {
    return deadline.slice(0, 10);
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
