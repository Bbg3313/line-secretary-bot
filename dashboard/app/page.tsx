import type { ChatRow, TaskRow } from "@/lib/supabase";
import { hasSupabaseConfig, supabase, supabaseUrlPrefix } from "@/lib/supabase";
import { getScheduleChats } from "@/lib/classify";
import { getDateKeyKST, getTodayDateKeyKST, isDeadlineTodayKST } from "@/lib/scheduleUtils";
import SummaryCards from "@/components/SummaryCards";
import AIBriefing from "@/components/AIBriefing";
import TaskTable from "@/components/TaskTable";

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
  const dueTodayCount = tasks.filter((t) => isDeadlineTodayKST(t.deadline)).length;
  const dueTodayExample =
    tasks.find((t) => isDeadlineTodayKST(t.deadline))?.hospital_name ||
    tasks.find((t) => isDeadlineTodayKST(t.deadline))?.description ||
    tasks.find((t) => isDeadlineTodayKST(t.deadline))?.title ||
    null;
  const todayScheduleCount = scheduleChats.filter((c) => getDateKeyKST(c.created_at) === todayKey).length;
  const todayTaskCount = tasks.filter((t) => getDateKeyKST(t.created_at) === todayKey).length;

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
      <section>
        <SummaryCards
          todayTaskCount={todayTaskCount}
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

      {hasSupabaseConfig && (
        <section className="rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2 text-xs text-slate-400">
          <p>디버그: chats {chats.length}건, tasks {tasks.length}건 로드됨</p>
          <p>연결 URL: {supabaseUrlPrefix}</p>
          {chats.length > 0 && tasks.length === 0 && (
            <p className="mt-1 text-amber-400">
              → tasks가 0건입니다. Render 백엔드와 같은 Supabase 프로젝트인지 확인하세요 (같은 URL). Supabase Table Editor에서 tasks 테이블에 행이 있는지도 확인하세요.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
