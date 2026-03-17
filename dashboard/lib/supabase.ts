import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** Vercel에 환경 변수를 넣었는지 확인용. false면 대시보드에 안내 배너 표시 */
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
/** 디버그용: 연결된 Supabase URL 앞부분 (어떤 프로젝트인지 확인) */
export const supabaseUrlPrefix = supabaseUrl ? `${supabaseUrl.slice(0, 40)}...` : "";

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    // Next 서버 컴포넌트에서 fetch 캐시로 인해 삭제/변경이 늦게 반영되는 케이스 방지
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }),
  },
});

export type ChatRow = {
  id: string;
  line_user_id: string | null;
  line_group_id: string | null;
  raw_message: string;
  gemini_analysis: string | null;
  created_at: string;
};

export type TaskRow = {
  id: string;
  chat_id: string | null;
  line_user_id: string | null;
  line_group_id: string | null;
  source_message: string | null;
  title: string | null;
  description: string | null;
  hospital_name: string | null;
  task_type: string | null;
  status: string;
  deadline: string | null;
  assignee: string | null;
  created_at: string;
};
