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

/** 내용 80자까지 보여주고 나머지는 말줄임 */
function truncateContent(text: string, maxLen = 80): string {
  if (!text) return "—";
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + "…";
}

export default function TaskTable({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleDone(id: string, current: string) {
    setTogglingId(id);
    const next = isDone(current) ? "대기" : "완료";
    const { error } = await supabase.from("tasks").update({ status: next }).eq("id", id);
    setTogglingId(null);
    if (!error) router.refresh();
  }

  const sorted = [...tasks].sort((a, b) => {
    const da = a.deadline || "";
    const db = b.deadline || "";
    if (da && db) return da.localeCompare(db);
    if (da) return -1;
    if (db) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const displayContent = (row: TaskRow) => row.title || row.description || "—";
  const displaySub = (row: TaskRow) => (row.title && row.description ? row.description : null);

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
                    isDone(row.status) ? "opacity-75" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <label className="flex cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isDone(row.status ?? "")}
                        disabled={togglingId === row.id}
                        onChange={() => toggleDone(row.id, row.status ?? "대기")}
                        className="h-5 w-5 cursor-pointer rounded border-slate-500 bg-slate-700 text-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 disabled:opacity-50"
                      />
                    </label>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-200">
                    {row.hospital_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.task_type || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {formatDeadline(row.deadline)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status ?? "대기")}`}
                    >
                      {statusLabel(row.status ?? "대기")}
                    </span>
                  </td>
                  <td className="max-w-[360px] px-4 py-3 text-slate-200">
                    <div className="block break-words">
                      <span
                        className={isDone(row.status ?? "") ? "line-through opacity-80" : "font-medium"}
                        title={row.description || row.title || undefined}
                      >
                        {truncateContent(displayContent(row), 60)}
                      </span>
                      {displaySub(row) && (
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                          {truncateContent(displaySub(row) ?? "", 80)}
                        </p>
                      )}
                    </div>
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
