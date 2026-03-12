import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ChatRow = {
  id: string;
  line_user_id: string | null;
  line_group_id: string | null;
  raw_message: string;
  gemini_analysis: string | null;
  created_at: string;
};
