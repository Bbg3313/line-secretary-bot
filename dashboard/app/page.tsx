import type { ChatRow, TaskRow } from "@/lib/supabase";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { getScheduleChats } from "@/lib/classify";
import { getDateKeyKST, getTodayDateKeyKST, isDeadlineTodayKST } from "@/lib/scheduleUtils";
import DashboardContent from "@/components/DashboardContent";

export const revalidate = 60;

async function getChats(): Promise<{ data: ChatRow[]; error?: string }> {
  if (!hasSupabaseConfig) return { data: [] };
  const { data, error } = await supabase
    .from("chats")
    .select("id, line_user_id, line_group_id, raw_message, gemini_analysis, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Supabase chats error:", error);
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as ChatRow[] };
}

async function getTasks(): Promise<{ data: TaskRow[]; error?: string }> {
  if (!hasSupabaseConfig) return { data: [] };
  const { data, error } = await supabase
    .from("tasks")
    .select("id, chat_id, line_user_id, line_group_id, source_message, title, description, hospital_name, task_type, status, deadline, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Supabase tasks error:", error);
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as TaskRow[] };
}

export default async function DashboardPage() {
  const [chatsRes, tasksRes] = await Promise.all([getChats(), getTasks()]);
  const chats = chatsRes.data;
  const tasks = tasksRes.data;
  const supabaseError = chatsRes.error || tasksRes.error;
  const scheduleChats = getScheduleChats(chats);
  const todayKey = getTodayDateKeyKST();

  const totalTasks = tasks.length;
  const isDone = (s: string | undefined) => s === "완료" || s === "done";
  const dueTodayCount = tasks.filter(
    (t) => !isDone(t?.status) && isDeadlineTodayKST(t?.deadline ?? null)
  ).length;
  const todayScheduleCount = scheduleChats.filter((c) => getDateKeyKST(c.created_at) === todayKey).length;
  const todayTaskCount = tasks.filter(
    (t) => !isDone(t?.status) && (isDeadlineTodayKST(t?.deadline ?? null) || getDateKeyKST(t?.created_at ?? "") === todayKey)
  ).length;

  return (
    <main className="space-y-10">
      {!hasSupabaseConfig && (
        <section className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-amber-200">
          <p className="font-medium">Supabase 연결 안 됨</p>
          <p className="mt-1 text-sm">
            Vercel 프로젝트 설정 → Environment Variables에 <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
            <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>를 넣고 저장한 뒤 <strong>Redeploy</strong> 해 주세요.
          </p>
        </section>
      )}
      {hasSupabaseConfig && supabaseError && (
        <section className="rounded-lg border border-red-500/60 bg-red-500/10 px-4 py-3 text-red-200">
          <p className="font-medium">Supabase 조회 오류</p>
          <p className="mt-1 text-sm">
            {supabaseError} — Supabase 대시보드에서 <code className="rounded bg-black/30 px-1">supabase_rls_policies.sql</code>을 실행했는지 확인하고, anon key가 맞는지 확인해 주세요.
          </p>
        </section>
      )}
      {hasSupabaseConfig && (
        <DashboardContent
          tasks={tasks}
          todayTaskCount={todayTaskCount}
          dueTodayCount={dueTodayCount}
          todayScheduleCount={todayScheduleCount}
          totalTasks={totalTasks}
          hasSupabaseConfig={hasSupabaseConfig}
          supabaseError={supabaseError}
        />
      )}
    </main>
  );
}
