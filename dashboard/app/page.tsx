import { supabase } from "@/lib/supabase";
import { getScheduleChats, getTaskChats } from "@/lib/classify";
import ScheduleSummary from "@/components/ScheduleSummary";
import IncompleteTasks from "@/components/IncompleteTasks";

export const revalidate = 60;

async function getChats() {
  const { data, error } = await supabase
    .from("chats")
    .select("id, line_user_id, line_group_id, raw_message, gemini_analysis, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Supabase error:", error);
    return [];
  }
  return data ?? [];
}

export default async function DashboardPage() {
  const chats = await getChats();
  const scheduleChats = getScheduleChats(chats);
  const taskChats = getTaskChats(chats);

  return (
    <main className="space-y-8">
      <section className="min-w-0">
        <ScheduleSummary chats={scheduleChats} />
      </section>
      <section className="min-w-0 lg:max-w-2xl">
        <IncompleteTasks chats={taskChats} />
      </section>
    </main>
  );
}
