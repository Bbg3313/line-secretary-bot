# LINE 비서 대시보드

Supabase `chats` 테이블 데이터를 읽어 **일정 요약** / **미완료 업무**를 구분해 보여주는 웹 대시보드입니다.

## 로컬 실행

1. 의존성 설치  
   `npm install`

2. 환경 변수  
   `.env.local.example`을 복사해 `.env.local` 생성 후 값 입력:
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key (publishable key)

3. 개발 서버  
   `npm run dev`  
   → http://localhost:3000

## Vercel 배포

1. [Vercel](https://vercel.com)에 로그인 후 **Import**로 이 저장소(또는 `dashboard` 폴더) 연결.

2. **Root Directory**를 `dashboard`로 지정.

3. **Environment Variables**에 추가:
   - `NEXT_PUBLIC_SUPABASE_URL` = Supabase 프로젝트 URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key

4. **Deploy** 후 배포 URL에서 대시보드 확인.

## 분류 기준

- **일정 요약**: `gemini_analysis` 또는 메시지에 일정/회의/약속/미팅/예약/날짜/시간 등 키워드가 포함된 경우.
- **미완료 업무**: 할일/해야/업무/미완료/TODO 등 키워드가 포함된 경우.
