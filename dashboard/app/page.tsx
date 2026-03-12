import { supabase } from "@/lib/supabase";
import { getScheduleChats } from "@/lib/classify";
import { getDateKeyKST, getTodayDateKeyKST, isDeadlineTodayKST } from "@/lib/scheduleUtils";
import SummaryCards from "@/components/SummaryCards";
import AIBriefing from "@/components/AIBriefing";
import TaskTable from "@/components/TaskTable";

export const revalidate = 60;

async function getChats() {
  const { data, error } = await supabase
    .from("chats")
    .select("id, raw_message, gemini_analysis, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Supabase chats error:", error);
    return [];
  }
  return data ?? [];
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
  return data ?? [];
}

export default async function DashboardPage() {
  const [chats, tasks] = await Promise.all([getChats(), getTasks()]);
  const scheduleChats = getScheduleChats(chats);
  const todayKey = getTodayDateKeyKST();

  const totalTasks = tasks.length;
  const dueTodayCount = tasks.filter((t) => isDeadlineTodayKST(t.deadline)).length;
  const dueTodayExample = tasks.find((t) => isDeadlineTodayKST(t.deadline))?.hospital_name || tasks.find((t) => isDeadlineTodayKST(t.deadline))?.title || null;
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
