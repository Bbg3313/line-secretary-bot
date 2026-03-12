import { supabase } from "@/lib/supabase";
import { getScheduleChats, getTaskChats } from "@/lib/classify";
import { getDateKeyKST, getTodayDateKeyKST } from "@/lib/scheduleUtils";
import ScheduleSummary from "@/components/ScheduleSummary";
import SummaryCards from "@/components/SummaryCards";
import AIBriefing from "@/components/AIBriefing";
import TaskKanban from "@/components/TaskKanban";

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

function getUrgentCount(chats: { raw_message: string | null; gemini_analysis: string | null }[]): number {
  const urgentKeywords = ["긴급", "마감", "ASAP", "즉시"];
  return chats.filter((c) => {
    const text = ((c.gemini_analysis ?? "") + " " + (c.raw_message ?? "")).toLowerCase();
    return urgentKeywords.some((k) => text.includes(k.toLowerCase()));
  }).length;
}

export default async function DashboardPage() {
  const chats = await getChats();
  const scheduleChats = getScheduleChats(chats);
  const taskChats = getTaskChats(chats);
  const todayKey = getTodayDateKeyKST();

  const todayTaskCount = taskChats.filter((c) => getDateKeyKST(c.created_at) === todayKey).length;
  const todayScheduleCount = scheduleChats.filter((c) => getDateKeyKST(c.created_at) === todayKey).length;
  const urgentCount = getUrgentCount(taskChats);

  const todayAnalyses = [...scheduleChats, ...taskChats]
    .filter((c) => getDateKeyKST(c.created_at) === todayKey && (c.gemini_analysis ?? "").trim())
    .map((c) => (c.gemini_analysis ?? "").trim());
  const highlightLine = todayAnalyses[0] ?? null;

  return (
    <main className="space-y-10">
      <section>
        <SummaryCards
          todayTaskCount={todayTaskCount}
          urgentCount={urgentCount}
          todayScheduleCount={todayScheduleCount}
        />
      </section>

      <section>
        <AIBriefing
          todayScheduleCount={todayScheduleCount}
          todayTaskCount={todayTaskCount}
          highlightLine={highlightLine}
        />
      </section>

      <section>
        <ScheduleSummary chats={scheduleChats} />
      </section>

      <section>
        <TaskKanban chats={taskChats} />
      </section>
    </main>
  );
}
