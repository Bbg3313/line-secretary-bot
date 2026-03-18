-- Supabase SQL Editor에서 실행 (chats/tasks에 보낸사람 표시이름 저장용 컬럼 추가)

alter table public.chats add column if not exists sender_name text;
alter table public.tasks add column if not exists sender_name text;

