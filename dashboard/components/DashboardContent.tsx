"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { TaskRow } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import {
  isDeadlineTodayKST,
  isDeadlineTodayOrPastKST,
  getDateKeyKST,
  getTodayDateKeyKST,
} from "@/lib/scheduleUtils";
import { generateBriefingFromTasks } from "@/lib/briefingUtils";
import SummaryCards from "@/components/SummaryCards";
import type { FilterMode } from "@/components/SummaryCards";
import AIBriefing from "@/components/AIBriefing";
import TaskTable from "@/components/TaskTable";

type DashboardContentProps = {
  tasks: TaskRow[];
  todayTaskCount: number;
  dueTodayCount: number;
  todayScheduleCount: number;
  totalTasks: number;
  hasSupabaseConfig?: boolean;
  supabaseError?: string;
};

function isDone(s: string | undefined) {
  return s === "완료" || s === "done";
}

export default function DashboardContent({
  tasks,
  todayTaskCount,
  dueTodayCount,
  todayScheduleCount,
}: DashboardContentProps) {
  const router = useRouter();
  const [filterMode, setFilterMode] = useState<FilterMode>(null);
  const [quickHospital, setQuickHospital] = useState<string | null>(null);
  const [quickTaskType, setQuickTaskType] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const todayKey = useMemo(() => getTodayDateKeyKST(), []);

  const uniqueHospitals = useMemo(() => {
    const set = new Set(tasks.map((t) => (t.hospital_name || "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [tasks]);

  const uniqueTaskTypes = useMemo(() => {
    const set = new Set(tasks.map((t) => (t.task_type || "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [tasks]);

  const tasksToShow = useMemo(() => {
    let list = tasks;
    if (filterMode === "today_task") {
      list = list.filter((t) => isDeadlineTodayOrPastKST(t?.deadline ?? null));
    } else if (filterMode === "urgent") {
      list = list.filter(
        (t) => !isDone(t?.status) && isDeadlineTodayKST(t?.deadline ?? null)
      );
    } else if (filterMode === "today_schedule") {
      list = list.filter(
        (t) =>
          isDeadlineTodayKST(t?.deadline ?? null) ||
          getDateKeyKST(t?.created_at ?? "") === todayKey
      );
    }
    if (quickHospital) {
      list = list.filter((t) => (t.hospital_name || "").trim() === quickHospital);
    }
    if (quickTaskType) {
      list = list.filter((t) => (t.task_type || "").trim() === quickTaskType);
    }
    return list;
  }, [tasks, filterMode, todayKey, quickHospital, quickTaskType]);

  const briefingText = useMemo(() => generateBriefingFromTasks(tasksToShow), [tasksToShow]);

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
          todayTaskCount={todayTaskCount}
          urgentCount={dueTodayCount}
          todayScheduleCount={todayScheduleCount}
          filterMode={filterMode}
          onFilter={(mode) => setFilterMode(mode)}
          onClearFilter={() => setFilterMode(null)}
        />
      </section>

      <section>
        <AIBriefing text={briefingText} />
      </section>

      <section>
        <TaskTable
          tasks={tasksToShow}
          filterMode={filterMode}
          onClearFilter={() => setFilterMode(null)}
          uniqueHospitals={uniqueHospitals}
          uniqueTaskTypes={uniqueTaskTypes}
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
          className="rounded border border-red-500/60 bg-red-950/80 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/60 disabled:opacity-50"
        >
          {deleting ? "삭제 중…" : "전체 삭제 (개발용)"}
        </button>
      </div>
    </>
  );
}
