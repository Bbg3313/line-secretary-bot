"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskRow } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "—";
  try {
    const formatter = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
      day: "numeric",
    });
    return formatter.format(new Date(deadline));
  } catch {
    return deadline.slice(0, 10);
  }
}

function statusLabel(s: string): string {
  if (s === "완료" || s === "done") return "완료";
  if (s === "진행중" || s === "in_progress") return "진행중";
  if (s === "긴급") return "긴급";
  return "대기";
}

function isDone(s: string): boolean {
  return s === "완료" || s === "done";
}

/** 상태별 뱃지 스타일: 대기=파랑, 진행중=노랑, 긴급=빨강, 완료=초록 */
function statusBadgeClass(s: string): string {
  if (isDone(s)) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (s === "진행중" || s === "in_progress") return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  if (s === "긴급") return "bg-red-500/20 text-red-300 border-red-500/40";
  return "bg-blue-500/20 text-blue-300 border-blue-500/40";
}

/** 내용 maxLen자까지만 보여주고 나머지는 말줄임 */
function truncateContent(text: string, maxLen = 80): string {
  if (!text) return "—";
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + "…";
}

/** 내용 컬럼용: "일정·업무 요약" 등 기계 문구 제거, 20자 이내 명확한 요약만 */
function contentSummary(row: TaskRow): string {
  const raw = (row.title || row.description || "").trim();
  if (!raw) return "—";
  const skip = /일정\s*·?\s*업무\s*요약|업무\s*요약|일정\s*업무/i;
  const use = skip.test(raw) ? (row.description || row.title || "").trim() : raw;
  const one = (use || "").trim();
  if (!one) return "—";
  const out = one.length <= 20 ? one : one.slice(0, 20) + "…";
  return out || "—";
}

export default function TaskTable({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});

  const getStatus = (row: TaskRow) => localStatus[row.id] ?? row.status ?? "대기";

  async function toggleDone(id: string, current: string) {
    const next = isDone(current) ? "대기" : "완료";
    setTogglingId(id);
    setLocalStatus((prev) => ({ ...prev, [id]: next }));
    const { error } = await supabase.from("tasks").update({ status: next }).eq("id", id);
    setTogglingId(null);
    if (error) {
      setLocalStatus((prev) => {
        const u = { ...prev };
        delete u[id];
        return u;
      });
      return;
    }
    router.refresh();
  }

  const sorted = [...tasks].sort((a, b) => {
    const da = a.deadline || "";
    const db = b.deadline || "";
    if (da && db) return da.localeCompare(db);
    if (da) return -1;
    if (db) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });


  return (
    <section className="rounded-xl border border-slate-600/80 bg-[#1e293b] p-6 shadow-xl">
      <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-white">
        <span className="text-2xl" aria-hidden>📋</span>
        업무 관리
      </h2>
      <div className="overflow-x-auto rounded-lg border border-slate-600/60 bg-slate-800/30">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-600/80 bg-slate-700/40">
              <th className="w-12 px-4 py-3.5 font-medium text-slate-400">완료</th>
              <th className="min-w-[100px] px-4 py-3.5 font-medium text-slate-400">병원명</th>
              <th className="min-w-[90px] px-4 py-3.5 font-medium text-slate-400">업무유형</th>
              <th className="min-w-[90px] px-4 py-3.5 font-medium text-slate-400">마감기한</th>
              <th className="min-w-[80px] px-4 py-3.5 font-medium text-slate-400">상태</th>
              <th className="px-4 py-3.5 font-medium text-slate-400">내용</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  아직 수집된 업무가 없어요. LINE 채팅에 할 일을 보내면 개별 업무로 쪼개져 저장돼요.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-slate-600/50 last:border-0 transition hover:bg-slate-700/50 ${
                    isDone(getStatus(row)) ? "opacity-75" : ""
                  }`}
                >
                  <td
                    className="cursor-pointer px-4 py-3 align-middle"
                    onClick={() => {
                      if (togglingId === row.id) return;
                      toggleDone(row.id, getStatus(row));
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (togglingId !== row.id) toggleDone(row.id, getStatus(row));
                      }
                    }}
                  >
                    <span className="inline-flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isDone(getStatus(row))}
                        disabled={togglingId === row.id}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleDone(row.id, getStatus(row));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5 cursor-pointer rounded border-slate-500 bg-slate-700 text-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 disabled:opacity-50"
                      />
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-200">
                    {row.hospital_name?.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.task_type?.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {formatDeadline(row.deadline)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(getStatus(row))}`}
                    >
                      {statusLabel(getStatus(row))}
                    </span>
                  </td>
                  <td className="max-w-[200px] px-4 py-3 text-slate-200" title={row.description || row.title || undefined}>
                    <span
                      className={isDone(getStatus(row)) ? "line-through opacity-80" : "font-medium"}
                    >
                      {contentSummary(row)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
