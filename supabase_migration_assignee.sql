-- Supabase SQL Editor에서 실행: tasks 테이블에 assignee 컬럼 추가
-- (대시보드 "column tasks.assignee does not exist" 오류 해결용)
alter table public.tasks add column if not exists assignee text;
