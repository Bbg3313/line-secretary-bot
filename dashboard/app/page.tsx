import type { ChatRow, TaskRow } from "@/lib/supabase";
import { hasSupabaseConfig, supabase, supabaseUrlPrefix } from "@/lib/supabase";
import { isDeadlineOverdueKST, normalizeTaskStatus, isAssigneeAssigned } from "@/lib/scheduleUtils";
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
    .select("id, chat_id, line_user_id, line_group_id, source_message, title, description, hospital_name, task_type, status, deadline, assignee, created_at")
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
  const tasks = tasksRes.data;
  const supabaseError = chatsRes.error || tasksRes.error;

  // 지시 완료 = status가 지시 완료/완료/done 이거나, 담당자가 지정된 경우(구 데이터 호환)
  const is지시완료 = (t: TaskRow) =>
    normalizeTaskStatus(t?.status) === "지시 완료" || isAssigneeAssigned((t as { assignee?: string | null }).assignee);

  // 1) 지시 대기 2) 지시 완료 3) 지연된 지시 (지시 대기 중 마감일 지남)
  const inProgressCount = tasks.filter(is지시완료).length;
  const inboxCount = tasks.length - inProgressCount;
  const urgentOverdueCount = tasks.filter((t) => {
    if (is지시완료(t)) return false;
    const deadline = t?.deadline ?? null;
    return !!deadline && isDeadlineOverdueKST(deadline);
  }).length;

  return (
    <main className="space-y-10">
      {!hasSupabaseConfig && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <p className="font-medium text-amber-800">Supabase 연결 안 됨</p>
          <p className="mt-1 text-sm text-amber-700">
            Vercel 프로젝트 설정 → Environment Variables에 <code className="rounded bg-amber-100 px-1 text-amber-900">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
            <code className="rounded bg-amber-100 px-1 text-amber-900">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>를 넣고 저장한 뒤 <strong>Redeploy</strong> 해 주세요.
          </p>
        </section>
      )}
      {hasSupabaseConfig && supabaseError && (
        <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
          <p className="font-medium text-red-800">Supabase 조회 오류</p>
          <p className="mt-1 text-sm text-red-700">
            {supabaseError} — Supabase 대시보드에서 <code className="rounded bg-red-100 px-1 text-red-900">supabase_rls_policies.sql</code>을 실행했는지 확인하고, anon key가 맞는지 확인해 주세요.
          </p>
        </section>
      )}
      {hasSupabaseConfig && tasks.length === 0 && !supabaseError && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3 shadow-sm">
          <p className="font-medium text-gray-900">데이터가 안 보일 때 확인</p>
          <p className="mt-1 text-sm text-gray-600">
            Supabase Table Editor에는 있는데 여기만 비어 있으면 → <strong>Vercel 환경 변수</strong>가 같은 프로젝트를 가리키는지 확인하세요.
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-gray-600">
            <li>Vercel 프로젝트 → Settings → Environment Variables에 <code className="rounded bg-gray-100 px-1 text-gray-800">NEXT_PUBLIC_SUPABASE_URL</code>, <code className="rounded bg-gray-100 px-1 text-gray-800">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 입력
            </li>
            <li>값 수정 후 반드시 <strong>Redeploy</strong> (NEXT_PUBLIC_* 는 빌드 시 적용됨)
            </li>
            <li>연결 중인 URL: <code className="break-all text-xs text-gray-500">{supabaseUrlPrefix || "(비어 있음)"}</code> — Supabase 대시보드 Project URL과 앞부분이 같아야 함
            </li>
            <li>같은 프로젝트에서 <code className="rounded bg-gray-100 px-1 text-gray-800">supabase_rls_policies.sql</code> 실행했는지 확인
            </li>
          </ul>
        </section>
      )}
      {hasSupabaseConfig && (
        <DashboardContent
          tasks={tasks}
          inboxCount={inboxCount}
          inProgressCount={inProgressCount}
          urgentOverdueCount={urgentOverdueCount}
          hasSupabaseConfig={hasSupabaseConfig}
          supabaseError={supabaseError}
        />
      )}
    </main>
  );
}
