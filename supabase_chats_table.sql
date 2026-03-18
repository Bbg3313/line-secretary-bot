-- Supabase SQL Editor에서 실행하여 chats 테이블을 만듭니다.

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  line_user_id text,
  line_group_id text,
  sender_name text,
  raw_message text not null,
  gemini_analysis text,
  created_at timestamptz default now()
);

-- (선택) RLS 정책: 서비스 역할(SUPABASE_KEY)으로만 접근할 경우 기본 정책으로 충분할 수 있음.
-- API 키가 service_role key라면 RLS를 끄거나, anon key라면 아래처럼 허용 정책을 추가하세요.
-- alter table public.chats enable row level security;
-- create policy "Allow service and anon" on public.chats for all using (true);
