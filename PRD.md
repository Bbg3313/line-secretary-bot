# LINE 비서 봇 프로젝트 PRD

## 1. 서비스 개요

LINE 메시지를 Gemini AI로 분석하여 **병원별 업무/일정**을 관리하는 대시보드.

- **입력**: LINE 채팅 메시지
- **처리**: Gemini 원자화 추출 → Supabase 저장
- **출력**: Next.js 대시보드(할 일·일정 카운트, 완료 처리, 필터)

---

## 2. 핵심 기능 요구사항

### 2.1 AI 분석

수신된 메시지에서 다음 4가지를 **정확히 추출**:

| 항목       | 설명 |
|------------|------|
| **병원명** | 등록된 15개 병원 리스트에 한정, 없으면 "기타" |
| **업무유형** | 광고예산, 콘텐츠, 세금계산서, CS, 예약, 마케팅, 행정, 미팅, 개인 |
| **마감기한** | 상대 표현("내일", "다음 주") → 절대 날짜(YYYY-MM-DD) |
| **요약내용** | title(핵심 키워드), description(한 줄 설명) |

- **구현**: `main.py` — `GEMINI_EXTRACT_PROMPT`, `analyze_and_extract()`, `_normalize_hospital()`, `_resolve_relative_date()`.

### 2.2 병원명 매핑

- **15개 병원 리스트**를 엄격히 준수. (코드에는 확장용으로 18개 등록 가능.)
- **등록명**: Jy, Clyve, Thebb, our, Delp, EverB, Seoulartline, will, Kleam, Lacela, DerAan, Renovo, Glory, harmony, Mi-k, MYCELL 등.
- **별칭 → 정규명**: 제이와이→Jy, 마이셀→MYCELL, 클라이브→Clyve, 서울아트라인→Seoulartline 등.
- **구현**: `main.py` — `HOSPITAL_CANONICAL`, `HOSPITAL_ALIASES`, `_normalize_hospital()`.

### 2.3 날짜 처리

- **상대 표현** → **절대 날짜(YYYY-MM-DD)**.
- 기준: **서버의 오늘 날짜** (`date.today()`). (PRD 문서 기준일 2026-03-13은 예시.)
- 예: "내일" → 오늘+1일, "다음 주 수요일" → 해당 주 수요일.
- **구현**: `main.py` — `_resolve_relative_date()`, Gemini 프롬프트 내 `{today_ymd}`.

### 2.4 대시보드

- **다크모드 UI**: 슬레이트 계열 배경·텍스트.
- **실시간 할 일/일정 카운트**: 상단 카드(오늘의 할 일, 긴급·주의, 오늘 일정).
- **체크박스 클릭 시 '완료' 상태 즉시 반영**: Supabase `tasks.status` 업데이트, 행 흐리게·취소선.
- **구현**: `dashboard/` — `SummaryCards`, `TaskTable`, `DashboardContent`, Supabase 클라이언트.

---

## 3. 데이터 무결성 규칙

### 3.1 빈 줄(Empty Row) 생성 금지

- **규칙**: `title` 또는 `description`이 비어 있는 task는 **저장하지 않음**.
- **구현**:
  - `analyze_and_extract()`: `if not desc or not desc.replace("\n", " ").strip(): continue`
  - `save_tasks_to_supabase()`: `if not desc or not title_str: continue`
  - Gemini 프롬프트: "실제 업무가 하나도 없으면 tasks: []", "빈 값 금지".

### 3.2 분석 실패 시 '기타' 분류 및 원문 보존

- **규칙**: 추출 실패 또는 병원 미매칭 시 **병원명 = "기타"**, **원문은 반드시 보존**.
- **구현**:
  - `_normalize_hospital()`: 미등록 병원 → `"기타"`.
  - Gemini 실패/파싱 실패 시: `_fallback_extract_from_message()`로 1건 생성, `hospital_name="기타"`, `description`/`source_message`에 원문 포함.
  - `save_tasks_to_supabase()`: `hospital_name` 빈 값 → `"기타"`, `task_type` 빈 값 → `"개인"`.

---

## 4. 참조

- **배포·웹훅·슬립 방지**: `DEPLOY.md`
- **Supabase 스키마·RLS**: `supabase_tasks_table.sql`, `supabase_chats_table.sql`, `supabase_rls_policies.sql`
- **LINE 웹훅 점검**: `LINE_WEBHOOK_CHECK.md`
