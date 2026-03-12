import type { ChatRow, TaskDisplayRow, TaskRow } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { getScheduleChats, getTaskChats } from "@/lib/classify";
import { getDateKeyKST, getTodayDateKeyKST, isDeadlineTodayKST } from "@/lib/scheduleUtils";
import SummaryCards from "@/components/SummaryCards";
import AIBriefing from "@/components/AIBriefing";
import TaskTable from "@/components/TaskTable";

export const revalidate = 60;

async function getChats() {
  const { data, error } = await supabase
    .from("chats")
    .select("id, line_user_id, line_group_id, raw_message, gemini_analysis, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Supabase chats error:", error);
    return [];
  }
  return (data ?? []) as ChatRow[];
}

async function getTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, chat_id, line_user_id, line_group_id, source_message, title, hospital_name, task_type, status, deadline, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Supabase tasks error:", error);
    return [];
  }
  return (data ?? []) as TaskRow[];
}

export default async function DashboardPage() {
  const [chats, tasksFromDb] = await Promise.all([getChats(), getTasks()]);
  const scheduleChats = getScheduleChats(chats);
  const taskChats = getTaskChats(chats);
  const todayKey = getTodayDateKeyKST();

  // tasks 테이블 행 + 채팅에서 업무로 분류된 항목 합침 (Supabase에 쌓인 기존 데이터도 표시)
  const tasksFromChats: TaskDisplayRow[] = taskChats.map((c) => ({
    id: c.id,
    chat_id: c.id,
    line_user_id: c.line_user_id,
    line_group_id: c.line_group_id,
    source_message: c.raw_message,
    title: c.raw_message,
    hospital_name: null,
    task_type: null,
    status: "pending",
    deadline: null,
    created_at: c.created_at,
    fromTasksTable: false,
  }));
  const tasksWithFromFlag: TaskDisplayRow[] = [
    ...tasksFromDb.map((t) => ({ ...t, fromTasksTable: true })),
    ...tasksFromChats.filter((tc) => !tasksFromDb.some((td) => td.chat_id === tc.id)), // 이미 tasks에 있으면 채팅 행 제외
  ];
  const tasks = tasksWithFromFlag.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const totalTasks = tasks.length;
  const dueTodayCount = tasksFromDb.filter((t) => isDeadlineTodayKST(t.deadline)).length;
  const dueTodayExample =
    tasksFromDb.find((t) => isDeadlineTodayKST(t.deadline))?.hospital_name ||
    tasksFromDb.find((t) => isDeadlineTodayKST(t.deadline))?.title ||
    null;
  const todayScheduleCount = scheduleChats.filter((c) => getDateKeyKST(c.created_at) === todayKey).length;

  return (
    <main className="space-y-10">
      <section>
        <SummaryCards
          todayTaskCount={totalTasks}
          urgentCount={dueTodayCount}
          todayScheduleCount={todayScheduleCount}
        />
      </section>

      <section>
        <AIBriefing
          totalTasks={totalTasks}
          dueTodayCount={dueTodayCount}
          dueTodayExample={dueTodayExample}
        />
      </section>

      <section>
        <TaskTable tasks={tasks} />
      </section>
    </main>
  );
}
