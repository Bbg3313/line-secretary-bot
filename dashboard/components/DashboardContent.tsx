"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskRow } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { isDeadlineTodayKST } from "@/lib/scheduleUtils";
import SummaryCards from "@/components/SummaryCards";
import AIBriefing from "@/components/AIBriefing";
import TaskTable from "@/components/TaskTable";

type DashboardContentProps = {
  tasks: TaskRow[];
  todayTaskCount: number;
  dueTodayCount: number;
  todayScheduleCount: number;
  totalTasks: number;
  briefingText: string;
  hasSupabaseConfig: boolean;
  supabaseError?: string;
};

export default function DashboardContent({
  tasks,
  todayTaskCount,
  dueTodayCount,
  todayScheduleCount,
  briefingText,
}: DashboardContentProps) {
  const router = useRouter();
  const [filterTodayOnly, setFilterTodayOnly] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tasksToShow = filterTodayOnly
    ? tasks.filter((t) => t?.status !== "완료" && t?.status !== "done" && isDeadlineTodayKST(t?.deadline ?? null))
    : tasks;

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
          onTodayClick={() => setFilterTodayOnly(true)}
          filterTodayActive={filterTodayOnly}
          onClearTodayFilter={() => setFilterTodayOnly(false)}
        />
      </section>

      <section>
        <AIBriefing text={briefingText} />
      </section>

      <section>
        <TaskTable
          tasks={tasksToShow}
          filterTodayActive={filterTodayOnly}
          onClearTodayFilter={() => setFilterTodayOnly(false)}
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
