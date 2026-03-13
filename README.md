# LINE 비서 봇

LINE 메시지를 받아 Gemini로 업무를 추출(병원명·업무유형·마감)하고 Supabase에 저장한 뒤, Next.js 대시보드에서 조회·완료 처리하는 AI 비서입니다.

## 구조

- **봇 (Python, FastAPI)**  
  `main.py` — LINE Webhook, Gemini 원자화 추출(병원/유형/마감), Supabase `chats`·`tasks` 저장, 답장. 슬립 방지용 `GET /ping`.
- **대시보드 (Next.js)**  
  `dashboard/` — Supabase `tasks` 조회, 오늘 할 일 필터, AI 한마디, 내용 팝업, 상태 뱃지, 개발용 전체 삭제.

## GitHub에 올리기

1. **저장소 생성**  
   [GitHub](https://github.com/new) → **New repository**  
   - Repository name: `line-secretary-bot` (원하는 이름으로 가능)  
   - Public, **Add a README file** 선택 안 해도 됨 → **Create repository**

2. **로컬에서 푸시** (프로젝트 폴더에서 실행)

   ```bash
   git init
   git add .
   git commit -m "Initial commit: LINE bot + dashboard"
   git branch -M main
   git remote add origin https://github.com/내계정/line-secretary-bot.git
   git push -u origin main
   ```

   `내계정`과 `line-secretary-bot`은 본인 GitHub 사용자명·저장소 이름으로 바꾸세요.

## Vercel에서 대시보드 배포

1. [Vercel](https://vercel.com) 로그인 → **Add New** → **Project**
2. **Import Git Repository**에서 방금 올린 저장소 선택
3. **Configure Project**에서:
   - **Root Directory** → **Edit** → `dashboard` 입력 후 **Save**
   - **Environment Variables** 추가:
     - `NEXT_PUBLIC_SUPABASE_URL` = Supabase 프로젝트 URL  
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key
4. **Deploy** 클릭

배포가 끝나면 Vercel이 부여한 URL에서 대시보드를 볼 수 있습니다.

## 로컬 실행

- **봇**: `pip install -r requirements.txt` 후 `.env` 설정, `python -m uvicorn main:app --port 8000`
- **대시보드**: `dashboard/` 폴더에서 `npm install`, `.env.local` 설정, `npm run dev`

- **요구사항 정리**: `PRD.md` — 서비스 개요, AI 분석·병원 매핑·날짜 처리·대시보드, 데이터 무결성 규칙.
- **배포·웹훅·슬립 방지**: `DEPLOY.md` — Render 배포, LINE Webhook URL, UptimeRobot/cron으로 `서비스URL/ping` 호출 시 슬립 방지.
- 대시보드 상세: `dashboard/README.md`
