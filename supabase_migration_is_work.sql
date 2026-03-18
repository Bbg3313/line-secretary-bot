-- Supabase SQL Editor에서 실행 (tasks 업무/비업무 필터용 컬럼 추가)

alter table public.tasks add column if not exists is_work boolean not null default true;

