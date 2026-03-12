# LINE 비서 봇

LINE 그룹 채팅을 수집·분석해 Supabase에 저장하고, 웹 대시보드로 일정/미완료 업무를 보여주는 프로젝트입니다.

## 구조

- **봇 (Python)**  
  `main.py` — LINE Webhook, Gemini 분석, Supabase 저장, 답장
- **대시보드 (Next.js)**  
  `dashboard/` — Supabase `chats` 조회, 일정 요약 / 미완료 업무 화면

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

자세한 설정은 `dashboard/README.md`를 참고하세요.
