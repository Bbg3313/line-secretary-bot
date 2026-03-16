-- Supabase SQL Editor에서 실행. 개별 업무 단위 저장용 tasks 테이블.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats(id) on delete set null,
  line_user_id text,
  line_group_id text,
  source_message text,
  hospital_name text,
  task_type text,
  deadline timestamptz,
  description text,
  status text not null default '대기',
  assignee text,
  created_at timestamptz default now()
);

-- 기존 테이블에 title만 있고 description이 없으면 추가
alter table public.tasks add column if not exists description text;
-- title 컬럼이 있으면 유지 (호환), 없으면 description로 표시
alter table public.tasks add column if not exists title text;
-- 담당자 (미정이면 null 또는 '미정')
alter table public.tasks add column if not exists assignee text;

-- RLS: 대시보드 anon 키로 조회·수정 가능 (필요 시 아래 두 줄 실행)
-- alter table public.tasks enable row level security;
-- create policy "Allow all for tasks" on public.tasks for all using (true) with check (true);
