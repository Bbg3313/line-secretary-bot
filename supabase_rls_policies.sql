-- 대시보드(Vercel)에서 anon 키로 Supabase 데이터를 보려면 아래 정책이 필요합니다.
-- Supabase 대시보드 → SQL Editor → New query → 붙여넣기 → Run

-- 1) chats: anon이 조회·삽입 가능 (백엔드가 anon 키로 넣을 수 있음)
alter table public.chats enable row level security;
drop policy if exists "Allow anon read chats" on public.chats;
create policy "Allow anon read chats"
  on public.chats for select to anon using (true);
drop policy if exists "Allow anon insert chats" on public.chats;
create policy "Allow anon insert chats"
  on public.chats for insert to anon with check (true);

-- 2) tasks: anon이 조회·삽입·수정 가능
alter table public.tasks enable row level security;
drop policy if exists "Allow anon read tasks" on public.tasks;
create policy "Allow anon read tasks"
  on public.tasks for select to anon using (true);
drop policy if exists "Allow anon insert tasks" on public.tasks;
create policy "Allow anon insert tasks"
  on public.tasks for insert to anon with check (true);
drop policy if exists "Allow anon update tasks" on public.tasks;
create policy "Allow anon update tasks"
  on public.tasks for update to anon using (true) with check (true);
-- 개발/테스트용: 전체 삭제 버튼 사용 시 필요
drop policy if exists "Allow anon delete tasks" on public.tasks;
create policy "Allow anon delete tasks"
  on public.tasks for delete to anon using (true);
