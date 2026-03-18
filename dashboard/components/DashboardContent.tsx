"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { TaskRow } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { isDeadlineOverdueKST, normalizeTaskStatus, isAssigneeAssigned, normalizeAssigneeName } from "@/lib/scheduleUtils";
import SummaryCards from "@/components/SummaryCards";
import type { FilterMode } from "@/components/SummaryCards";
import AssigneeCards from "@/components/AssigneeCards";
import TaskTable from "@/components/TaskTable";

/** 5대 업무유형 카테고리 (통제소 정규화) */
export const TASK_TYPE_CATEGORIES = [
  "광고/마케팅",
  "콘텐츠/디자인",
  "고객/예약(CS)",
  "경영/행정",
  "플랫폼/IT",
] as const;

type DashboardContentProps = {
  tasks: TaskRow[];
  hasSupabaseConfig?: boolean;
  supabaseError?: string;
};

function is지시완료(t: TaskRow) {
  return normalizeTaskStatus(t?.status) === "지시 완료" || isAssigneeAssigned((t as { assignee?: string | null }).assignee);
}

export default function DashboardContent({
  tasks,
}: DashboardContentProps) {
  const router = useRouter();
  const [filterMode, setFilterMode] = useState<FilterMode>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [quickHospital, setQuickHospital] = useState<string | null>(null);
  const [quickTaskType, setQuickTaskType] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 상단 카드 카운트: tasks 기준으로 즉시 계산 (새로고침/업데이트 후 바로 반영)
  const { inboxCount, inProgressCount, urgentOverdueCount } = useMemo(() => {
    const inProgress = tasks.filter(is지시완료).length;
    const inbox = tasks.length - inProgress;
    const urgent = tasks.filter((t) => {
      if (is지시완료(t)) return false;
      const deadline = t?.deadline ?? null;
      return !!deadline && isDeadlineOverdueKST(deadline);
    }).length;
    return { inboxCount: inbox, inProgressCount: inProgress, urgentOverdueCount: urgent };
  }, [tasks]);

  const uniqueHospitals = useMemo(() => {
    const set = new Set(tasks.map((t) => (t.hospital_name || "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [tasks]);

  const tasksToShow = useMemo(() => {
    let list = tasks;
    if (filterMode === "inbox") {
      list = list.filter((t) => !is지시완료(t));
    } else if (filterMode === "in_progress") {
      list = list.filter(is지시완료);
    } else if (filterMode === "urgent_overdue") {
      list = list.filter((t) => {
        if (is지시완료(t)) return false;
        const deadline = t?.deadline ?? null;
        return !!deadline && isDeadlineOverdueKST(deadline);
      });
    }
    if (quickHospital) {
      list = list.filter((t) => (t.hospital_name || "").trim() === quickHospital);
    }
    if (quickTaskType) {
      list = list.filter((t) => (t.task_type || "").trim() === quickTaskType);
    }
    if (assigneeFilter) {
      const a = (t: TaskRow) => normalizeAssigneeName((t as { assignee?: string | null }).assignee ?? null);
      list = list.filter((t) => a(t) === assigneeFilter);
    }
    return list;
  }, [tasks, filterMode, assigneeFilter, quickHospital, quickTaskType]);

  async function handleDeleteAll() {
    if (!confirm("개발용: tasks 테이블 전체 삭제합니다. 계속할까요?")) return;
    setDeleting(true);
    try {
      const ids = tasks.map((t) => t.id);
      if (ids.length === 0) {
        setDeleting(false);
        return;
      }
      const { error } = await supabase.from("tasks").delete().in("id", ids);
      if (error) throw error;
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("삭제 실패: " + (e instanceof Error ? e.message : String(e)));
    }
    setDeleting(false);
  }

  return (
    <>
      <section>
        <SummaryCards
          inboxCount={inboxCount}
          inProgressCount={inProgressCount}
          urgentOverdueCount={urgentOverdueCount}
          filterMode={filterMode}
          onFilter={(mode) => setFilterMode(mode)}
          onClearFilter={() => setFilterMode(null)}
        />
      </section>

      <section>
        <AssigneeCards
          tasks={tasks}
          selectedAssignee={assigneeFilter}
          onSelectAssignee={setAssigneeFilter}
        />
      </section>

      <section>
        <TaskTable
          tasks={tasksToShow}
          totalTaskCount={tasks.length}
          filterMode={filterMode}
          onClearFilter={() => setFilterMode(null)}
          onClearAllFilters={() => {
            setFilterMode(null);
            setAssigneeFilter(null);
            setQuickHospital(null);
            setQuickTaskType(null);
          }}
          uniqueHospitals={uniqueHospitals}
          uniqueTaskTypes={[...TASK_TYPE_CATEGORIES]}
          quickHospital={quickHospital}
          quickTaskType={quickTaskType}
          onQuickHospitalChange={setQuickHospital}
          onQuickTaskTypeChange={setQuickTaskType}
        />
      </section>

      <div className="fixed bottom-4 right-4">
        <button
          type="button"
          onClick={handleDeleteAll}
          disabled={deleting}
          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
        >
          {deleting ? "삭제 중…" : "전체 삭제 (개발용)"}
        </button>
      </div>
    </>
  );
}
