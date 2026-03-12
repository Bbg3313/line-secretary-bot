-- Supabase SQL Editor에서 실행하여 tasks 테이블을 만듭니다.
-- 각 LINE 메시지에서 추출된 '업무(Task)'를 원자 단위로 저장합니다.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats(id) on delete set null,
  line_user_id text,
  line_group_id text,
  source_message text,
  title text not null,
  hospital_name text,
  task_type text, -- 예: 광고, 미팅, 개인
  status text not null default 'pending', -- pending / in_progress / done
  deadline timestamptz, -- 마감 기한 (없을 수 있음)
  created_at timestamptz default now()
);

-- 대시보드에서 조회·완료 체크 시 anon 키로 접근하려면 RLS를 열어두거나 아래 정책을 추가하세요.
-- alter table public.tasks enable row level security;
-- create policy "Allow all for anon" on public.tasks for all using (true) with check (true);

