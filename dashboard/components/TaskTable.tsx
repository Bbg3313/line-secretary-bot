"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TaskRow } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { revalidateDashboard } from "@/app/actions";
import {
  ASSIGNEE_OPTIONS,
  getDateKeyKST,
  getDateLabel,
  normalizeAssigneeName,
} from "@/lib/scheduleUtils";

/** 상태 라벨: 지시 대기 / 지시 완료 / 작업완료 (기존 DB 값은 여기서 정규화) */
function statusLabel(s: string): string {
  if (s === "작업완료") return "작업완료";
  if (s === "지시 완료") return "지시 완료";
  if (s === "완료" || s === "done") return "지시 완료";
  return "지시 대기";
}

function is지시완료(s: string): boolean {
  return statusLabel(s) === "지시 완료" || statusLabel(s) === "작업완료";
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

function ReceivedAtCell({ createdAt }: { createdAt: string }) {
  const dateKey = getDateKeyKST(createdAt);
  const label = getDateLabel(dateKey);
  return <span className="text-sm text-gray-700">{label}</span>;
}

const STATUS_OPTIONS = ["지시 대기", "지시 완료", "작업완료"] as const;
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
  const [contentPopup, setContentPopup] = useState<TaskRow | null>(null);
  const [editRow, setEditRow] = useState<TaskRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"지시 대기" | "지시 완료" | "작업완료" | null>(null);
  const [workFilter, setWorkFilter] = useState<"work" | "non_work" | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const getStatus = (row: TaskRow) => statusLabel(localStatus[row.id] ?? row.status ?? "지시 대기");
  const getAssignee = (row: TaskRow) =>
    normalizeAssigneeName(
      localAssignee[row.id] ?? (((row as any).assignee as string | null | undefined) ?? null),
    );
  const getIsWork = (row: TaskRow) => ((row as any).is_work as boolean | null | undefined) !== false;

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

  async function toggleIsWork(row: TaskRow) {
    const current = getIsWork(row);
    const next = !current;
    const nextStatus = next ? "지시 대기" : "작업완료";
    setLocalStatus((prev) => ({ ...prev, [row.id]: nextStatus }));
    const { error } = await supabase.from("tasks").update({ is_work: next, status: nextStatus }).eq("id", row.id);
    if (error) {
      console.error(error);
      alert("업무/비업무 변경 실패: " + error.message);
      setLocalStatus((prev) => {
        const u = { ...prev };
        delete u[row.id];
        return u;
      });
      return;
    }
    router.refresh();
  }

  async function handleSaveEdit(payload: {
    hospital_name: string;
    task_type: string;
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

  // 상태별 개수 (지시 대기 / 지시 완료 / 작업완료)
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

  const filteredByWork = filteredByStatus.filter((t) => {
    if (!workFilter) return true;
    const isWork = getIsWork(t);
    return workFilter === "work" ? isWork : !isWork;
  });

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredBySearch = normalizedSearch
    ? filteredByWork.filter((row) => {
        const hospital = (row.hospital_name || "").toLowerCase();
        const title = (row.title || "").toLowerCase();
        const desc = (row.description || "").toLowerCase();
        return (
          hospital.includes(normalizedSearch) ||
          title.includes(normalizedSearch) ||
          desc.includes(normalizedSearch)
        );
      })
    : filteredByWork;

  // 정렬: 수신일(created_at) 최신 순
  const sorted = [...filteredBySearch].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());


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

      {/* 상태 필터 + 검색바 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-gray-500">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">상태</span>
          {[
            { key: null as "지시 대기" | "지시 완료" | "작업완료" | null, label: `전체 (${tasks.length})` },
            { key: "지시 대기" as const, label: `지시 대기 (${statusCounts["지시 대기"] || 0})` },
            { key: "지시 완료" as const, label: `지시 완료 (${statusCounts["지시 완료"] || 0})` },
            { key: "작업완료" as const, label: `작업완료 (${statusCounts["작업완료"] || 0})` },
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
          <span className="ml-4 text-xs font-medium uppercase tracking-wider text-gray-500">업무</span>
          <select
            value={workFilter ?? ""}
            onChange={(e) => setWorkFilter((e.target.value || null) as "work" | "non_work" | null)}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 min-w-[110px]"
          >
            <option value="">전체</option>
            <option value="work">업무만</option>
            <option value="non_work">비업무만</option>
          </select>
          <span className="ml-4 text-xs font-medium uppercase tracking-wider text-gray-500">업무유형</span>
          <select
            value={quickTaskType ?? ""}
            onChange={(e) => onQuickTaskTypeChange?.(e.target.value || null)}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 min-w-[120px]"
          >
            <option value="">전체</option>
            {uniqueTaskTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="병원명·내용 검색"
            className="w-44 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
      </div>

      <div className="max-h-[600px] overflow-x-auto overflow-y-auto rounded-lg border border-gray-100 scrollbar-thin">
        <table className="w-full min-w-[900px] text-left text-base">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="min-w-[100px] px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">병원명</th>
              <th className="min-w-[90px] px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">업무유형</th>
              <th className="min-w-[90px] px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">담당자</th>
              <th className="min-w-[90px] px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">보낸사람</th>
              <th className="min-w-[140px] px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">수신일</th>
              <th className="min-w-[110px] px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">상태</th>
              <th className="px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">내용</th>
              <th className="w-24 px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">관리</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center">
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
              sorted.map((row) => {
                const completed = statusLabel(getStatus(row)) === "작업완료";
                const nonWork = !getIsWork(row);
                return (
                <tr
                  key={row.id}
                  className={`border-b border-gray-100 last:border-0 transition hover:bg-slate-50 ${
                    completed ? "opacity-60 bg-gray-50/50" : nonWork ? "opacity-50 bg-slate-50/60" : ""
                  }`}
                >
                  <td className={`px-4 py-3 font-medium text-base ${completed ? "text-gray-500" : "text-gray-900"}`}>
                    {row.hospital_name?.trim() || "기타"}
                  </td>
                  <td className={`px-4 py-3 text-base ${completed ? "text-gray-500" : "text-gray-700"}`}>
                    {row.task_type?.trim() || "개인"}
                  </td>
                  <td className="px-4 py-3">
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

                        const { error } = await supabase
                          .from("tasks")
                          .update(payload)
                          .eq("id", row.id)
                          .select("id, assignee, status")
                          .single();

                        if (error) {
                          console.error(error);
                          const msg = String(error.message || "");
                          const hint =
                            msg.includes("assignee") || msg.includes("status")
                              ? "\n\nSupabase SQL Editor에서 supabase_migration_assignee.sql 내용(ALTER TABLE ... assignee ...)을 실행했는지 확인하세요."
                              : "";
                          alert("담당자 변경 실패: " + msg + hint);
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

                        if (prevAssignee !== next) {
                          setToastMessage(`🚀 ${next}님에게 업무가 배정(변경)되었습니다.`);
                          setTimeout(() => setToastMessage(null), 3000);
                        }
                        try {
                          await revalidateDashboard();
                        } catch (_) {}
                        router.refresh();
                        setTimeout(() => window.location.reload(), 1200);
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
                  <td className={`px-4 py-3 text-base ${completed ? "text-gray-500" : "text-gray-700"}`}>
                    {(row.sender_name?.trim() || "—")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ReceivedAtCell createdAt={row.created_at} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ${statusBadgeClass(getStatus(row))}`}
                      >
                        {statusLabel(getStatus(row))}
                      </span>
                      {nonWork && (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          비업무
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`max-w-[260px] px-4 py-3 text-base ${completed ? "text-gray-500" : "text-gray-900"}`}>
                    <button
                      type="button"
                      className={`max-w-full cursor-pointer text-left focus:outline-none ${
                        completed ? "opacity-70 text-gray-600" : "font-medium"
                      }`}
                      onClick={() => setContentPopup(row)}
                      title="전체 내용 보기"
                    >
                      <span className="block truncate">{truncatedContent(row)}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-row flex-nowrap items-center gap-3">
                      <div className="flex flex-col gap-1">
                        {!completed && (
                          <button
                            type="button"
                            onClick={async () => {
                              await updateStatus(row.id, "작업완료");
                            }}
                            className="h-7 w-12 rounded-md border border-sky-400 bg-sky-50 text-[11px] font-semibold text-sky-700 hover:bg-sky-100 hover:border-sky-500"
                          >
                            완료
                          </button>
                        )}
                        {completed && (
                          <button
                            type="button"
                            onClick={async () => {
                              await updateStatus(row.id, "지시 완료");
                            }}
                            className="h-7 w-12 rounded-md border border-gray-300 bg-white text-[11px] font-semibold text-gray-600 hover:bg-gray-100 hover:border-gray-400"
                          >
                            복구
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await toggleIsWork(row);
                        }}
                        className={`h-7 w-12 rounded-md border text-[11px] font-semibold ${
                          getIsWork(row)
                            ? "border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:border-gray-400"
                            : "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-400"
                        }`}
                        title={getIsWork(row) ? "비업무로 표시" : "업무로 표시"}
                      >
                        {getIsWork(row) ? "비업무" : "업무"}
                      </button>
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
              )})
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
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">병원명</div>
            <p className="mb-3 text-sm font-medium text-gray-900">
              {contentPopup.hospital_name?.trim() || "기타"}
            </p>
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">업무유형</div>
            <p className="mb-2 text-sm text-gray-700">
              {contentPopup.task_type?.trim() || "개인"}
            </p>
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">담당자</div>
            <p className="mb-2 text-sm text-gray-700">
              {(((contentPopup as any).assignee as string | null | undefined)?.trim() || "미정")}
            </p>
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">보낸사람</div>
            <p className="mb-2 text-sm text-gray-700">
              {((contentPopup.sender_name as string | null | undefined)?.trim() || "—")}
            </p>
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">상태</div>
            <p className="mb-3 text-sm text-gray-700">
              {statusLabel(contentPopup.status || "")}
            </p>
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">수신일</div>
            <p className="mb-3 text-sm text-gray-700">
              <ReceivedAtCell createdAt={contentPopup.created_at} />
            </p>
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">상세 내용</div>
            <p className="mb-3 whitespace-pre-wrap text-sm text-gray-700">
              {contentPopup.description?.trim() || "—"}
            </p>
            {contentPopup.source_message && (
              <>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">원본 메시지 (LINE)</div>
                <p className="whitespace-pre-wrap text-sm text-gray-700">
                  {contentPopup.source_message.trim()}
                </p>
              </>
            )}
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

/** 수정 모달: 병원명, 상태, 제목, 내용 편집 후 저장 */
function EditTaskModal({
  row,
  onSave,
  onClose,
}: {
  row: TaskRow;
  onSave: (p: {
    hospital_name: string;
    task_type: string;
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
  const [assignee, setAssignee] = useState<string>(
    normalizeAssigneeName(((row as any).assignee as string | null | undefined) ?? null),
  );
  const [title, setTitle] = useState(row.title?.trim() || "");
  const [description, setDescription] = useState(row.description?.trim() || "");

  // 상태는 담당자에 따라 자동: 미정 → 지시 대기, 지정 → 지시 완료
  const derivedStatus = normalizeAssigneeName(assignee) === "미정" ? "지시 대기" : "지시 완료";

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave({
      hospital_name: hospital_name.trim() || "기타",
      task_type: task_type.trim() || TASK_TYPE_OPTIONS[0],
      assignee: normalizeAssigneeName(assignee),
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
