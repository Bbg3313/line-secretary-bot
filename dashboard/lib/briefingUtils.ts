import type { TaskRow } from "./supabase";
import { isDeadlineTodayKST, isDeadlineTomorrowKST } from "./scheduleUtils";

function isDone(s: string | undefined): boolean {
  return s === "완료" || s === "done";
}

/**
 * 현재 표에 있는 업무 목록을 기반으로 동적 브리핑 문장 생성.
 * 예: "대표님, 내일 마감인 업무가 3건(세금계산서 등) 있습니다. 기한 없음 상태인 광고예산 업무 2건의 일정을 확인해주세요."
 */
export function generateBriefingFromTasks(tasks: TaskRow[]): string {
  if (!tasks.length) {
    return "대표님, 현재 표시된 업무가 없습니다.";
  }

  const active = tasks.filter((t) => !isDone(t?.status));
  const tomorrow = active.filter((t) => isDeadlineTomorrowKST(t?.deadline ?? null));
  const today = active.filter((t) => isDeadlineTodayKST(t?.deadline ?? null));
  const noDeadline = active.filter((t) => !(t?.deadline || "").trim());

  const parts: string[] = [];

  if (tomorrow.length > 0) {
    const types = [...new Set(tomorrow.map((t) => t.task_type || "개인").filter(Boolean))];
    const typeStr = types.length <= 2 ? types.join(", ") : `${types[0]} 등`;
    parts.push(`내일 마감인 업무가 ${tomorrow.length}건(${typeStr}) 있습니다.`);
  }
  if (today.length > 0) {
    parts.push(`오늘 마감인 업무가 ${today.length}건 있습니다.`);
  }
  if (noDeadline.length > 0) {
    const byType = new Map<string, number>();
    noDeadline.forEach((t) => {
      const type = t.task_type?.trim() || "개인";
      byType.set(type, (byType.get(type) || 0) + 1);
    });
    const typeCounts = Array.from(byType.entries())
      .map(([type, n]) => `${type} ${n}건`)
      .join(", ");
    parts.push(`기한 없음 상태인 업무 ${noDeadline.length}건(${typeCounts})의 일정을 확인해주세요.`);
  }

  if (parts.length === 0 && active.length > 0) {
    parts.push(`총 ${active.length}건의 미완료 업무가 있습니다.`);
  }
  if (parts.length === 0 && tasks.length > 0) {
    parts.push(`총 ${tasks.length}건의 업무가 있습니다.`);
  }

  const raw = "대표님, " + parts.join(" ");
  return raw.replace(/\.+$/, ".") || "대표님, 현재 표시된 업무가 없습니다.";
}
