# Vercel 배포 체크리스트

대시보드만 Vercel에 배포할 때 아래 순서대로 하면 됩니다.

## 1. Vercel 접속

- https://vercel.com 로그인 (GitHub로 로그인 권장)

## 2. 프로젝트 임포트

- **Add New** → **Project**
- **Import Git Repository**에서 `Bbg3313/line-secretary-bot` 선택
- **Import** 클릭

## 3. 설정 (Configure Project)

- **Root Directory**
  - **Edit** 클릭 → `dashboard` 입력 → **Continue**
- **Environment Variables** (필수)
  - Name: `NEXT_PUBLIC_SUPABASE_URL`  
    Value: Supabase 대시보드 → Project Settings → API → **Project URL**
  - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
    Value: Supabase **anon key** (publishable key)

## 4. 배포

- **Deploy** 클릭
- 끝나면 **Visit** 또는 배포 URL로 접속해서 대시보드 확인

---

배포 URL은 예: `https://line-secretary-dashboard-xxx.vercel.app` 형태입니다.

---

# Render.com 배포 (LINE 봇 웹훅 서버, ngrok 대체)

봇 백엔드를 Render 무료 서버에 올리면 ngrok 없이 24시간 웹훅을 받을 수 있습니다.

## 1. Render 가입 및 저장소 연결

- https://render.com 가입 (GitHub 연동 권장)
- **Dashboard** → **New** → **Web Service**
- **Connect a repository**에서 `Bbg3313/line-secretary-bot` 선택 (또는 본인 fork)
- **Branch**: `main`

## 2. 설정

| 항목 | 값 |
|------|-----|
| **Name** | `line-secretary-bot` (원하는 이름) |
| **Region** | Oregon (또는 가까운 지역) |
| **Root Directory** | 비워두기 (프로젝트 루트) |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

## 3. 환경 변수 (Environment)

**Key** 추가 (Value는 본인 값으로):

- `CHANNEL_SECRET` — LINE Developers 채널 시크릿
- `CHANNEL_ACCESS_TOKEN` — LINE 채널 액세스 토큰
- `GEMINI_API_KEY` — Google AI Studio API 키
- `SUPABASE_URL` — Supabase Project URL
- `SUPABASE_KEY` — Supabase service_role 또는 anon key  
- `GEMINI_MODEL` — (선택) 예: `models/gemini-2.0-flash`

## 4. 배포 후 LINE 웹훅 URL 변경

- Render 배포가 끝나면 **서비스 URL**이 나옵니다. 예: `https://line-secretary-bot-xxxx.onrender.com`
- LINE Developers 콘솔 → 해당 채널 → **Messaging API** 탭 → **Webhook URL**을  
  `https://line-secretary-bot-xxxx.onrender.com/callback` (또는 `/webhook`) 로 설정하고 **Verify** 후 저장.

## 5. 서버 실행 명령어 정리

- **Render (배포)**  
  `uvicorn main:app --host 0.0.0.0 --port $PORT`  
  (Render가 `PORT`를 넣어줌)

- **로컬**  
  `python main.py`  
  또는  
  `uvicorn main:app --host 0.0.0.0 --port 8000`  
  (기본 8000, `PORT` 환경 변수 있으면 그 값 사용)
