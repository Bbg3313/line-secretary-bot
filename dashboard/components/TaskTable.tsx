"use client";

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
  return "대기";
}

function isDone(s: string): boolean {
  return s === "완료" || s === "done";
}

export default function TaskTable({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();

  async function toggleDone(id: string, current: string) {
    const next = isDone(current) ? "대기" : "완료";
    const { error } = await supabase.from("tasks").update({ status: next }).eq("id", id);
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

  const displayContent = (row: TaskRow) => row.description || row.title || "—";

  return (
    <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 shadow-xl">
      <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-slate-200">
        <span className="text-2xl" aria-hidden>📋</span>
        업무 관리
      </h2>
      <div className="overflow-x-auto rounded-lg border border-slate-600/80 bg-slate-800/40">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-600/80 bg-slate-700/50">
              <th className="w-10 px-3 py-3 font-medium text-slate-400">완료</th>
              <th className="px-4 py-3 font-medium text-slate-400">병원명</th>
              <th className="w-24 px-4 py-3 font-medium text-slate-400">업무유형</th>
              <th className="w-28 px-4 py-3 font-medium text-slate-400">마감기한</th>
              <th className="w-20 px-4 py-3 font-medium text-slate-400">상태</th>
              <th className="px-4 py-3 font-medium text-slate-400">내용</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  아직 수집된 업무가 없어요. LINE 채팅에 할 일을 보내면 개별 업무로 쪼개져 저장돼요.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-slate-600/60 last:border-0 hover:bg-slate-700/30 transition ${
                    isDone(row.status) ? "opacity-80" : ""
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isDone(row.status)}
                      onChange={() => toggleDone(row.id, row.status)}
                      className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-200">
                    {row.hospital_name || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">
                    {row.task_type || "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-300">
                    {formatDeadline(row.deadline)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        isDone(row.status)
                          ? "text-emerald-400"
                          : row.status === "진행중" || row.status === "in_progress"
                            ? "text-amber-400"
                            : "text-slate-400"
                      }
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-200">
                    <span className={isDone(row.status) ? "line-through opacity-80" : ""}>
                      {displayContent(row)}
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
