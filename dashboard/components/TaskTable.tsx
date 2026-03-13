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

/** 상태별 뱃지 스타일: 눈에 띄게 구분 (대기=파랑, 진행중=노랑, 긴급=빨강, 완료=초록) */
function statusBadgeClass(s: string): string {
  if (isDone(s)) return "bg-emerald-600/30 text-emerald-200 border border-emerald-500/60 font-semibold";
  if (s === "진행중" || s === "in_progress") return "bg-amber-500/30 text-amber-200 border border-amber-500/60 font-semibold";
  if (s === "긴급") return "bg-red-600/30 text-red-200 border border-red-500/60 font-semibold";
  return "bg-blue-600/30 text-blue-200 border border-blue-500/60 font-semibold";
}

/** 내용 maxLen자까지만 보여주고 나머지는 말줄임 */
function truncateContent(text: string, maxLen = 80): string {
  if (!text) return "—";
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + "…";
}

/** 기계 문구 제거 (일정·업무·요약 관련) */
const GENERIC_PHRASE = /일정\s*·?\s*업무\s*요약|일정\s*업무\s*요약|업무\s*요약|^일정\s*업무\s*$/gi;
type TaskTableProps = {
  tasks: TaskRow[];
  filterTodayActive?: boolean;
  onClearTodayFilter?: () => void;
};

export default function TaskTable({ tasks, filterTodayActive, onClearTodayFilter }: TaskTableProps) {
  const router = useRouter();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
  const [contentPopup, setContentPopup] = useState<{ title: string; description: string } | null>(null);

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


  const displayContent = (row: TaskRow) => (row.title || row.description || "").trim() || "—";
  const truncatedContent = (row: TaskRow) => {
    let full = displayContent(row);
    if (!full || full === "—") return "—";
    full = full.replace(GENERIC_PHRASE, "").trim() || full;
    return full.length <= 40 ? full : full.slice(0, 40) + "…";
  };

  return (
    <section className="rounded-xl border border-slate-600/80 bg-[#1e293b] p-6 shadow-xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
          <span className="text-2xl" aria-hidden>📋</span>
          업무 관리
        </h2>
        {filterTodayActive && onClearTodayFilter && (
          <span className="rounded-md bg-emerald-500/20 px-3 py-1 text-sm text-emerald-300">
            오늘 마감만 표시 중 <button type="button" className="ml-1 font-medium underline hover:no-underline" onClick={onClearTodayFilter}>해제</button>
          </span>
        )}
      </div>
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
                    isDone(getStatus(row)) ? "opacity-60 bg-slate-800/40" : ""
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
                    {row.hospital_name?.trim() || "기타"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.task_type?.trim() || "개인"}
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
                  <td className="max-w-[220px] px-4 py-3 text-slate-200">
                    <button
                      type="button"
                      className={`max-w-full cursor-pointer text-left hover:underline focus:underline focus:outline-none ${isDone(getStatus(row)) ? "line-through opacity-80" : "font-medium"}`}
                      onClick={() => setContentPopup({ title: row.title || "—", description: row.description || "—" })}
                      title="전체 내용 보기"
                    >
                      <span className="block truncate">{truncatedContent(row)}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {contentPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setContentPopup(null)}
          role="dialog"
          aria-modal="true"
          aria-label="전체 내용"
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-sm font-medium text-slate-400">제목</div>
            <p className="mb-4 text-slate-200">{contentPopup.title}</p>
            <div className="mb-2 text-sm font-medium text-slate-400">내용</div>
            <p className="whitespace-pre-wrap text-slate-200">{contentPopup.description}</p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="rounded bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-500"
                onClick={() => setContentPopup(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
