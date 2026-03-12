import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

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
  title: string;
  hospital_name: string | null;
  task_type: string | null;
  status: string;
  deadline: string | null;
  created_at: string;
};

/** tasks 테이블 행 + 채팅에서 합쳐진 업무(표시용). fromTasksTable=false면 채팅 출처, 체크박스 비활성 */
export type TaskDisplayRow = TaskRow & { fromTasksTable?: boolean };
