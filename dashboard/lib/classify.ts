import type { ChatRow } from "./supabase";

export type ChatCategory = "schedule" | "task" | "other";

const SCHEDULE_KEYWORDS = [
  "일정", "회의", "약속", "미팅", "예약", "날짜", "오전", "오후", "시", "캘린더",
  "내일", "모레", "다음 주", "다음주", "회의실", "화상",
];
const TASK_KEYWORDS = [
  "할일", "해야", "업무", "미완료", "todo", "해야 할", "해야할", "과제", "제출", "마감",
];

function matchKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

export function classifyChat(chat: ChatRow): ChatCategory {
  const analysis = (chat.gemini_analysis ?? "") + " " + (chat.raw_message ?? "");
  if (matchKeywords(analysis, SCHEDULE_KEYWORDS)) return "schedule";
  if (matchKeywords(analysis, TASK_KEYWORDS)) return "task";
  return "other";
}

export function getScheduleChats(chats: ChatRow[]): ChatRow[] {
  return chats.filter((c) => classifyChat(c) === "schedule");
}

export function getTaskChats(chats: ChatRow[]): ChatRow[] {
  return chats.filter((c) => classifyChat(c) === "task");
}
