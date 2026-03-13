"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TaskRow } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import {
  formatDeadlineWithWeekday,
  isDeadlineTodayKST,
  isDeadlineSoonKST,
} from "@/lib/scheduleUtils";

function statusLabel(s: string): string {
  if (s === "완료" || s === "done") return "완료";
  if (s === "진행중" || s === "in_progress") return "진행중";
  if (s === "긴급") return "긴급";
  return "대기";
}

function isDone(s: string): boolean {
  return s === "완료" || s === "done";
}

/** 상태 뱃지 컬러: 대기=연한파랑, 진행중=주황(Warning), 완료=초록(Success), 긴급=빨강(Danger) */
function statusBadgeClass(s: string): string {
  if (isDone(s)) return "bg-emerald-600/25 text-emerald-200 border border-emerald-500/50 font-medium";
  if (s === "진행중" || s === "in_progress") return "bg-amber-500/30 text-amber-200 border border-amber-500/50 font-medium";
  if (s === "긴급") return "bg-red-600/30 text-red-200 border border-red-500/50 font-medium";
  return "bg-slate-500/20 text-slate-300 border border-slate-500/40 font-medium";
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

/** 마감기한 셀: 오늘 [오늘] 빨강, 내일 [내일] 주황, 없으면 기한 없음, 형식 03/14 (토) */
function DeadlineCell({ deadline }: { deadline: string | null }) {
  if (!deadline || !deadline.trim()) {
    return <span className="text-slate-500">기한 없음</span>;
  }
  const text = formatDeadlineWithWeekday(deadline) || deadline.slice(0, 10);
  const isToday = isDeadlineTodayKST(deadline);
  const isSoon = isDeadlineSoonKST(deadline, 2);
  return (
    <span className={`font-mono ${isToday ? "text-red-400" : isSoon ? "text-amber-400" : "text-slate-300"}`}>
      {text}
      {isToday && (
        <span className="ml-1.5 rounded bg-red-500/30 px-1.5 py-0.5 text-xs font-medium text-red-300">오늘</span>
      )}
    </span>
  );
}

const STATUS_OPTIONS = ["대기", "진행중", "긴급", "완료"] as const;

type TaskTableProps = {
  tasks: TaskRow[];
  totalTaskCount?: number;
  filterMode?: "today_task" | "urgent" | "today_schedule" | null;
  onClearFilter?: () => void;
  onClearAllFilters?: () => void;
  uniqueHospitals?: string[];
  uniqueTaskTypes?: string[];
  quickHospital?: string | null;
  quickTaskType?: string | null;
  onQuickHospitalChange?: (v: string | null) => void;
  onQuickTaskTypeChange?: (v: string | null) => void;
};

export default function TaskTable({
  tasks,
  totalTaskCount = 0,
  filterMode,
  onClearFilter,
  onClearAllFilters,
  uniqueHospitals = [],
  uniqueTaskTypes = [],
  quickHospital = null,
  quickTaskType = null,
  onQuickHospitalChange,
  onQuickTaskTypeChange,
}: TaskTableProps) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
  const [contentPopup, setContentPopup] = useState<{ title: string; description: string } | null>(null);
  const [editRow, setEditRow] = useState<TaskRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"대기" | "진행중" | "완료" | "긴급" | null>(null);

  const getStatus = (row: TaskRow) => localStatus[row.id] ?? row.status ?? "대기";

  async function updateStatus(id: string, next: string) {
    setLocalStatus((prev) => ({ ...prev, [id]: next }));
    const { error } = await supabase.from("tasks").update({ status: next }).eq("id", id);
    if (error) {
      console.error(error);
      alert("상태 변경 실패: " + error.message);
      setLocalStatus((prev) => {
        const u = { ...prev };
        delete u[id];
        return u;
      });
      return;
    }
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      console.error(error);
      alert("삭제 실패: " + error.message);
      return;
    }
    router.refresh();
  }

  async function handleSaveEdit(payload: {
    hospital_name: string;
    task_type: string;
    deadline: string | null;
    status: string;
    title: string;
    description: string;
  }) {
    if (!editRow) return;
    const { error } = await supabase
      .from("tasks")
      .update({
        hospital_name: payload.hospital_name || "기타",
        task_type: payload.task_type || "개인",
        deadline: payload.deadline || null,
        status: payload.status,
        title: payload.title,
        description: payload.description,
      })
      .eq("id", editRow.id);
    if (error) {
      alert("저장 실패: " + error.message);
      return;
    }
    setEditRow(null);
    router.refresh();
  }

  // 상태별 개수 (상태 탭 표시용) — 로컬 상태 반영해서 드롭다운 변경 시 즉시 숫자 갱신
  const statusCounts = tasks.reduce((acc, t) => {
    const s = statusLabel(getStatus(t));
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // 상태 필터 적용 — getStatus 사용해서 드롭다운 변경 직후 필터에도 반영
  const filteredByStatus = statusFilter
    ? tasks.filter((t) => statusLabel(getStatus(t)) === statusFilter)
    : tasks;

  // 정렬: 마감 있음 → 날짜 순, 마감 없음(기한 없음)은 가장 하단
  const sorted = [...filteredByStatus].sort((a, b) => {
    const da = (a.deadline || "").trim();
    const db = (b.deadline || "").trim();
    if (!da && !db) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (!da) return 1;
    if (!db) return -1;
    const cmp = da.localeCompare(db);
    if (cmp !== 0) return cmp;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });


  const displayContent = (row: TaskRow) => (row.title || row.description || "").trim() || "—";
  const truncatedContent = (row: TaskRow) => {
    let full = displayContent(row);
    if (!full || full === "—") return "—";
    full = full.replace(GENERIC_PHRASE, "").trim() || full;
    return full.length <= 40 ? full : full.slice(0, 40) + "…";
  };

  const filterLabel =
    filterMode === "today_task"
      ? "오늘의 할 일"
      : filterMode === "urgent"
        ? "긴급 · 주의"
        : filterMode === "today_schedule"
          ? "오늘 일정"
          : null;

  return (
    <section className="rounded-xl border border-slate-600/80 bg-[#1e293b] p-6 shadow-xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
          <span className="text-2xl" aria-hidden>📋</span>
          업무 관리
        </h2>
        {filterLabel && onClearFilter && (
          <span className="rounded-md bg-emerald-500/20 px-3 py-1 text-sm text-emerald-300">
            {filterLabel} 필터 적용 중 <button type="button" className="ml-1 font-medium underline hover:no-underline" onClick={onClearFilter}>해제</button>
          </span>
        )}
      </div>

      {/* 퀵 필터 바 */}
      <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-slate-600/60 bg-slate-800/20 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">병원</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onQuickHospitalChange?.(null)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              !quickHospital ? "bg-slate-600 text-white" : "bg-slate-700/60 text-slate-400 hover:bg-slate-600/80 hover:text-slate-200"
            }`}
          >
            전체
          </button>
          {uniqueHospitals.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onQuickHospitalChange?.(quickHospital === h ? null : h)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                quickHospital === h ? "bg-slate-600 text-white" : "bg-slate-700/60 text-slate-400 hover:bg-slate-600/80 hover:text-slate-200"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
        <span className="ml-4 border-l border-slate-600/60 pl-4 text-xs font-medium uppercase tracking-wider text-slate-500">업무유형</span>
        <select
          value={quickTaskType ?? ""}
          onChange={(e) => onQuickTaskTypeChange?.(e.target.value ? e.target.value : null)}
          className="rounded-md border border-slate-600 bg-slate-700/80 px-2.5 py-1 text-xs text-slate-200 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">전체</option>
          {uniqueTaskTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* 상태 탭 */}
      <div className="mb-4 flex flex-wrap items-center gap-2 px-1 text-xs text-slate-400">
        <span className="font-medium">상태</span>
        {[
          { key: null as "대기" | "진행중" | "완료" | "긴급" | null, label: "전체" },
          { key: "대기" as const, label: `대기 (${statusCounts["대기"] || 0})` },
          { key: "진행중" as const, label: `진행중 (${statusCounts["진행중"] || 0})` },
          { key: "완료" as const, label: `완료 (${statusCounts["완료"] || 0})` },
          { key: "긴급" as const, label: `긴급 (${statusCounts["긴급"] || 0})` },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setStatusFilter(item.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              statusFilter === item.key
                ? "bg-slate-100 text-slate-900"
                : "bg-slate-700/40 text-slate-300 hover:bg-slate-600/60"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="max-h-[600px] overflow-x-auto overflow-y-auto rounded-lg border border-slate-600/60 bg-slate-800/30 scrollbar-thin">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-600/80 bg-slate-700/40">
              <th className="min-w-[100px] px-4 py-4 font-medium text-slate-400">병원명</th>
              <th className="min-w-[90px] px-4 py-4 font-medium text-slate-400">업무유형</th>
              <th className="min-w-[90px] px-4 py-4 font-medium text-slate-400">마감기한</th>
              <th className="min-w-[80px] px-4 py-4 font-medium text-slate-400">상태</th>
              <th className="px-4 py-4 font-medium text-slate-400">내용</th>
              <th className="w-24 px-4 py-4 font-medium text-slate-400">관리</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  {totalTaskCount > 0 ? (
                    <div className="text-slate-400">
                      <p className="font-medium">필터 조건에 맞는 업무가 없어요.</p>
                      <p className="mt-1 text-sm">필터를 해제하면 전체 목록을 볼 수 있어요.</p>
                      {onClearAllFilters && (
                        <button
                          type="button"
                          onClick={onClearAllFilters}
                          className="mt-3 rounded-md bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-500"
                        >
                          필터 모두 해제
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500">
                      아직 수집된 업무가 없어요. LINE 채팅에 할 일을 보내면 개별 업무로 쪼개져 저장돼요.
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-slate-600/50 last:border-0 transition hover:bg-slate-700/50 ${
                    isDone(getStatus(row)) ? "opacity-50 bg-slate-800/40 [&_td]:line-through" : ""
                  }`}
                >
                  <td className="px-4 py-4 font-medium text-slate-200">
                    {row.hospital_name?.trim() || "기타"}
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    {row.task_type?.trim() || "개인"}
                  </td>
                  <td className="px-4 py-4">
                    <DeadlineCell deadline={row.deadline} />
                  </td>
                  <td className="px-4 py-4">
                    <select
                      value={statusLabel(getStatus(row))}
                      onChange={(e) => updateStatus(row.id, e.target.value)}
                      className={`rounded-md border px-2 py-1 text-xs font-medium bg-transparent ${statusBadgeClass(getStatus(row))} focus:outline-none`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s} className="bg-slate-800 text-slate-100">
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="max-w-[220px] px-4 py-4 text-slate-200">
                    <button
                      type="button"
                      className={`max-w-full cursor-pointer text-left hover:underline focus:underline focus:outline-none ${isDone(getStatus(row)) ? "opacity-80" : "font-medium"}`}
                      onClick={() => setContentPopup({ title: row.title || "—", description: row.description || "—" })}
                      title="전체 내용 보기"
                    >
                      <span className="block truncate">{truncatedContent(row)}</span>
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditRow(row)}
                        className="rounded p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-600/60 hover:text-emerald-300"
                        title="수정"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        className="rounded p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-500/25 hover:text-red-400 disabled:opacity-50"
                        title="삭제"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
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

      {editRow && (
        <EditTaskModal
          row={editRow}
          onSave={handleSaveEdit}
          onClose={() => setEditRow(null)}
        />
      )}
    </section>
  );
}

/** 수정 모달: 병원명, 마감기한, 상태, 제목, 내용 편집 후 저장 */
function EditTaskModal({
  row,
  onSave,
  onClose,
}: {
  row: TaskRow;
  onSave: (p: {
    hospital_name: string;
    task_type: string;
    deadline: string | null;
    status: string;
    title: string;
    description: string;
  }) => void;
  onClose: () => void;
}) {
  const [hospital_name, setHospitalName] = useState(row.hospital_name?.trim() || "기타");
  const [task_type, setTaskType] = useState(row.task_type?.trim() || "개인");
  const [deadline, setDeadline] = useState(row.deadline ? row.deadline.slice(0, 10) : "");
  const [status, setStatus] = useState(row.status || "대기");
  const [title, setTitle] = useState(row.title?.trim() || "");
  const [description, setDescription] = useState(row.description?.trim() || "");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave({
      hospital_name: hospital_name.trim() || "기타",
      task_type: task_type.trim() || "개인",
      deadline: deadline.trim() || null,
      status,
      title: title.trim() || description.slice(0, 50),
      description: description.trim() || title.trim() || "업무",
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="업무 수정"
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold text-white">업무 수정</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">병원명</label>
            <input
              type="text"
              value={hospital_name}
              onChange={(e) => setHospitalName(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">업무유형</label>
            <input
              type="text"
              value={task_type}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">마감기한</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">내용</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              취소
            </button>
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
