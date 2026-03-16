"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TaskRow } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import {
  formatDeadlineWithWeekday,
  isDeadlineTodayKST,
  isDeadlineSoonKST,
  isDeadlineOverdueKST,
} from "@/lib/scheduleUtils";

/** 상태는 오직 두 가지: 지시 대기 / 지시 완료 (기존 DB 값은 여기서 정규화) */
function statusLabel(s: string): string {
  if (s === "지시 완료") return "지시 완료";
  if (s === "완료" || s === "done") return "지시 완료";
  return "지시 대기";
}

function is지시완료(s: string): boolean {
  return statusLabel(s) === "지시 완료";
}

/** 상태 뱃지 (라이트): 지시 대기 = 회색/빨강 파스텔, 지시 완료 = 초록 파스텔 */
function statusBadgeClass(s: string): string {
  if (is지시완료(s)) return "bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium";
  return "bg-red-50 text-red-600 border border-red-200 font-medium";
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

/** 마감기한 셀 (라이트): 지연=빨강+[지연] 뱃지, 오늘=빨강, 촉박=주황, 없으면 기한 없음 */
function DeadlineCell({ deadline }: { deadline: string | null }) {
  if (!deadline || !deadline.trim()) {
    return <span className="text-gray-500">기한 없음</span>;
  }
  const text = formatDeadlineWithWeekday(deadline) || deadline.slice(0, 10);
  const isOverdue = isDeadlineOverdueKST(deadline);
  const isToday = isDeadlineTodayKST(deadline);
  const isSoon = !isOverdue && !isToday && isDeadlineSoonKST(deadline, 2);
  return (
    <span className={`font-mono ${isOverdue ? "text-red-600" : isToday ? "text-red-600" : isSoon ? "text-amber-600" : "text-gray-700"}`}>
      {text}
      {isOverdue && (
        <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-600 border border-red-200">🚨 [지연]</span>
      )}
      {isToday && !isOverdue && (
        <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">오늘</span>
      )}
    </span>
  );
}

const STATUS_OPTIONS = ["지시 대기", "지시 완료"] as const;
const ASSIGNEE_OPTIONS = ["미정", "대표님", "A팀장", "마케팅팀", "쏨차이(태국CS)", "베트남담당"] as const;
/** 5대 업무유형 (통제소 정규화) */
const TASK_TYPE_OPTIONS = ["광고/마케팅", "콘텐츠/디자인", "고객/예약(CS)", "경영/행정", "플랫폼/IT"] as const;

type TaskTableProps = {
  tasks: TaskRow[];
  totalTaskCount?: number;
  filterMode?: "inbox" | "in_progress" | "urgent_overdue" | null;
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
  const [localAssignee, setLocalAssignee] = useState<Record<string, string>>({});
  const [contentPopup, setContentPopup] = useState<{ title: string; description: string } | null>(null);
  const [editRow, setEditRow] = useState<TaskRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"지시 대기" | "지시 완료" | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const getStatus = (row: TaskRow) => statusLabel(localStatus[row.id] ?? row.status ?? "지시 대기");
  const getAssignee = (row: TaskRow) =>
    localAssignee[row.id] ??
    (((row as any).assignee as string | null | undefined)?.trim() || "미정");

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
    assignee?: string;
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
        assignee: payload.assignee ?? getAssignee(editRow),
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

  // 상태별 개수 (지시 대기 / 지시 완료만)
  const statusCounts = tasks.reduce((acc, t) => {
    const s = getStatus(t);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // 상태 필터: [전체] [지시 대기] [지시 완료]
  const filteredByStatus = tasks.filter((t) => {
    const label = getStatus(t);
    if (!statusFilter) return true;
    return label === statusFilter;
  });

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
    filterMode === "inbox"
      ? "지시 대기"
      : filterMode === "in_progress"
        ? "지시 완료"
        : filterMode === "urgent_overdue"
          ? "지연된 지시"
          : null;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <span className="text-2xl" aria-hidden>📋</span>
          업무 관리
        </h2>
        {filterLabel && onClearFilter && (
          <span className="rounded-md bg-blue-50 px-3 py-1 text-sm text-blue-600 border border-blue-100">
            {filterLabel} 필터 적용 중 <button type="button" className="ml-1 font-medium underline hover:no-underline" onClick={onClearFilter}>해제</button>
          </span>
        )}
      </div>

      {/* 퀵 필터 바 */}
      <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">병원</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onQuickHospitalChange?.(null)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              !quickHospital ? "bg-gray-200 text-gray-900" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
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
                quickHospital === h ? "bg-gray-200 text-gray-900" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
        <span className="ml-4 border-l border-gray-200 pl-4 text-xs font-medium uppercase tracking-wider text-gray-500">업무유형</span>
        <select
          value={quickTaskType ?? ""}
          onChange={(e) => onQuickTaskTypeChange?.(e.target.value || null)}
          className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 min-w-[140px]"
        >
          <option value="">전체</option>
          {uniqueTaskTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* 상태 필터: [전체] [지시 대기] [지시 완료] */}
      <div className="mb-4 flex flex-wrap items-center gap-2 px-1 text-xs text-gray-500">
        <span className="font-medium">상태</span>
        {[
          { key: null as "지시 대기" | "지시 완료" | null, label: `전체 (${tasks.length})` },
          { key: "지시 대기" as const, label: `지시 대기 (${statusCounts["지시 대기"] || 0})` },
          { key: "지시 완료" as const, label: `지시 완료 (${statusCounts["지시 완료"] || 0})` },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setStatusFilter(item.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              statusFilter === item.key
                ? "bg-gray-200 text-gray-900"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="max-h-[600px] overflow-x-auto overflow-y-auto rounded-lg border border-gray-100 scrollbar-thin">
        <table className="w-full min-w-[900px] text-left text-base">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="min-w-[100px] px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">병원명</th>
              <th className="min-w-[90px] px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">업무유형</th>
              <th className="min-w-[90px] px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">담당자</th>
              <th className="min-w-[90px] px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">마감기한</th>
              <th className="min-w-[80px] px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">상태</th>
              <th className="px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">내용</th>
              <th className="w-24 px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">관리</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  {totalTaskCount > 0 ? (
                    <div className="text-gray-500">
                      <p className="font-medium">필터 조건에 맞는 업무가 없어요.</p>
                      <p className="mt-1 text-sm">필터를 해제하면 전체 목록을 볼 수 있어요.</p>
                      {onClearAllFilters && (
                        <button
                          type="button"
                          onClick={onClearAllFilters}
                          className="mt-3 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
                        >
                          필터 모두 해제
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">
                      아직 수집된 업무가 없어요. LINE 채팅에 할 일을 보내면 개별 업무로 쪼개져 저장돼요.
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-gray-100 last:border-0 transition hover:bg-slate-50 ${
                    is지시완료(getStatus(row)) ? "opacity-60 bg-gray-50/50 [&_td]:line-through" : ""
                  }`}
                >
                  <td className="px-4 py-5 font-medium text-gray-900 text-base">
                    {row.hospital_name?.trim() || "기타"}
                  </td>
                  <td className="px-4 py-5 text-gray-700 text-base">
                    {row.task_type?.trim() || "개인"}
                  </td>
                  <td className="px-4 py-5">
                    <select
                      value={getAssignee(row)}
                      onChange={async (e) => {
                        const next = e.target.value;
                        const prevAssignee = getAssignee(row);
                        // 담당자 변경 시 상태 자동 연동: 미정 → 지시 대기, 지정 → 지시 완료
                        const nextStatus = next === "미정" ? "지시 대기" : "지시 완료";

                        setLocalAssignee((prev) => ({ ...prev, [row.id]: next }));
                        setLocalStatus((prev) => ({ ...prev, [row.id]: nextStatus }));

                        const payload = { assignee: next, status: nextStatus };

                        const { error } = await supabase.from("tasks").update(payload).eq("id", row.id);
                        if (error) {
                          console.error(error);
                          if (
                            String(error.message || "").includes("assignee") ||
                            String(error.message || "").includes("status")
                          ) {
                            console.warn(
                              "tasks 테이블에 assignee/status 컬럼이 없어 로컬 상태로만 담당자를 변경합니다.",
                            );
                            return;
                          }
                          alert("담당자 변경 실패: " + error.message);
                          setLocalAssignee((prev) => {
                            const u = { ...prev };
                            delete u[row.id];
                            return u;
                          });
                          setLocalStatus((prev) => {
                            const u = { ...prev };
                            delete u[row.id];
                            return u;
                          });
                          return;
                        }
                        // 담당자가 A→B로 변경될 때마다 무조건 토스트
                        if (prevAssignee !== next) {
                          setToastMessage(`🚀 ${next}님에게 업무가 배정(변경)되었습니다.`);
                          setTimeout(() => setToastMessage(null), 3000);
                        }
                        router.refresh();
                        // 카운트 등 최신 반영을 위해 잠시 후 페이지 새로고침
                        setTimeout(() => window.location.reload(), 800);
                      }}
                      className="min-w-[150px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    >
                      {ASSIGNEE_OPTIONS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-5">
                    <DeadlineCell deadline={row.deadline} />
                  </td>
                  <td className="px-4 py-5">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ${statusBadgeClass(getStatus(row))}`}
                    >
                      {statusLabel(getStatus(row))}
                    </span>
                  </td>
                  <td className="max-w-[260px] px-4 py-5 text-gray-900 text-base">
                    <button
                      type="button"
                      className={`max-w-full cursor-pointer text-left hover:underline focus:underline focus:outline-none ${is지시완료(getStatus(row)) ? "opacity-70 text-gray-600" : "font-medium"}`}
                      onClick={() => setContentPopup({ title: row.title || "—", description: row.description || "—" })}
                      title="전체 내용 보기"
                    >
                      <span className="block truncate">{truncatedContent(row)}</span>
                    </button>
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex flex-row flex-nowrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditRow(row)}
                        className="rounded p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-emerald-600"
                        title="수정"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        className="rounded p-2 text-gray-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setContentPopup(null)}
          role="dialog"
          aria-modal="true"
          aria-label="전체 내용"
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">제목</div>
            <p className="mb-4 text-gray-900">{contentPopup.title}</p>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">내용</div>
            <p className="whitespace-pre-wrap text-gray-700">{contentPopup.description}</p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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

      {toastMessage && (
        <div
          className="fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-emerald-200 bg-white px-6 py-3 text-sm font-medium text-emerald-700 shadow-sm"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
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
    assignee?: string;
    status: string;
    title: string;
    description: string;
  }) => void;
  onClose: () => void;
}) {
  const [hospital_name, setHospitalName] = useState(row.hospital_name?.trim() || "기타");
  const initialTaskType = row.task_type?.trim() || "";
  const [task_type, setTaskType] = useState(
    (TASK_TYPE_OPTIONS as readonly string[]).includes(initialTaskType) ? initialTaskType : TASK_TYPE_OPTIONS[0]
  );
  const [deadline, setDeadline] = useState(row.deadline ? row.deadline.slice(0, 10) : "");
  const [assignee, setAssignee] = useState<string>(
    ((row as any).assignee as string | null | undefined) || "미정",
  );
  const [title, setTitle] = useState(row.title?.trim() || "");
  const [description, setDescription] = useState(row.description?.trim() || "");

  // 상태는 담당자에 따라 자동: 미정 → 지시 대기, 지정 → 지시 완료
  const derivedStatus = (assignee?.trim() || "미정") === "미정" ? "지시 대기" : "지시 완료";

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave({
      hospital_name: hospital_name.trim() || "기타",
      task_type: task_type.trim() || TASK_TYPE_OPTIONS[0],
      deadline: deadline.trim() || null,
      assignee: assignee.trim() || "미정",
      status: derivedStatus,
      title: title.trim() || description.slice(0, 50),
      description: description.trim() || title.trim() || "업무",
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="업무 수정"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold text-gray-900">업무 수정</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">병원명</label>
            <input
              type="text"
              value={hospital_name}
              onChange={(e) => setHospitalName(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">업무유형</label>
            <select
              value={task_type}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              {TASK_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">담당자</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              {ASSIGNEE_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">마감기한</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">상태 (담당자에 따라 자동)</label>
            <input
              type="text"
              readOnly
              value={derivedStatus}
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">내용</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
