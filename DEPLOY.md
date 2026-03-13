# 최근 수정본 전부 배포하기

- **백엔드(Render)**: GitHub `main`에 푸시되어 있으면 Render가 자동 배포함. Render 대시보드에서 상태 확인.
- **대시보드(Vercel)**: 아래 "Vercel 배포 체크리스트"대로 한 번만 설정해 두면, 이후에는 **GitHub에 푸시할 때마다 자동 배포**됨.  
  이미 연결해 뒀다면 → Vercel 대시보드 → 해당 프로젝트 → **Deployments** → **Redeploy** (최신 커밋 기준으로 다시 배포).

---

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
- **Environment Variables** (필수 — 안 넣으면 대시보드에 데이터가 안 보임)
  - Name: `NEXT_PUBLIC_SUPABASE_URL`  
    Value: Supabase 대시보드 → Project Settings → API → **Project URL**
  - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
    Value: Supabase **anon key** (Project Settings → API → anon public)

## 4. Supabase RLS 정책 (필수 — 안 하면 대시보드에 데이터 0건)

- Supabase 대시보드 → **SQL Editor** → **New query**
- 프로젝트 루트의 `supabase_rls_policies.sql` 내용 전체 복사 후 붙여넣기 → **Run**
- 이렇게 해야 Vercel 대시보드(anon 키)가 `chats` / `tasks` 테이블을 조회·수정할 수 있습니다.

## 5. 배포

- **Deploy** 클릭
- 끝나면 **Visit** 또는 배포 URL로 접속 → Supabase에 쌓인 업무/채팅이 보여야 합니다. 안 보이면 위 3번(환경 변수), 4번(RLS 정책)을 다시 확인한 뒤 Vercel에서 **Redeploy** 하세요.

### 대시보드에 chats는 보이는데 tasks만 0건일 때

1. **같은 Supabase 프로젝트인지 확인**  
   - Vercel 대시보드 페이지 맨 아래 "디버그"에 나온 **연결 URL**과, Render의 환경 변수 **SUPABASE_URL**이 **완전히 동일한** 프로젝트인지 확인하세요. (다르면 Render는 A에 저장하고, 대시보드는 B를 보고 있는 것.)
2. **Supabase Table Editor**  
   - 해당 프로젝트 → **Table Editor** → **tasks** 테이블을 열어서 실제로 행이 있는지 확인하세요. 없으면 백엔드(Render)가 이 프로젝트에 tasks를 안 넣고 있는 것이므로 Render의 SUPABASE_URL/SUPABASE_KEY를 확인하세요.
3. **RLS**  
   - `supabase_rls_policies.sql`을 그 프로젝트에서 한 번 더 실행해 보세요.

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

## 4. 배포 완료 후 체크리스트 (필수)

빌드가 끝나고 **Live** 상태가 되면 아래 순서대로 진행하세요.

| 순서 | 작업 | 확인 |
|------|------|------|
| ① | Render 대시보드에서 **서비스 URL** 복사 (예: `https://line-secretary-bot-xxxx.onrender.com`) | |
| ② | 브라우저에서 `서비스URL/` 접속 → `{"status":"ok"}` 나오면 서버 정상 | |
| ③ | [LINE Developers](https://developers.line.biz/) → 본인 채널 → **Messaging API** 탭 | |
| ④ | **Webhook URL**에 `서비스URL/callback` 입력 (예: `https://line-secretary-bot-xxxx.onrender.com/callback`) | |
| ⑤ | **Verify** 클릭 → 성공 시 **Use** 버튼으로 저장 | |
| ⑥ | LINE 앱에서 봇에게 메시지 보내서 응답 오는지 확인 | |

- 무료 플랜은 **15분 비활성 시 슬립**됩니다. 그 후 첫 요청은 약 50초 지연될 수 있습니다.
- 웹훅은 **/callback** 또는 **/webhook** 둘 다 사용 가능합니다.

### LINE에 응답이 안 올 때

1. **슬립 상태 (가장 흔함)**  
   브라우저에서 `https://본인서비스이름.onrender.com/` 한 번 열어서 서버를 깨운 뒤, **1분 안에** LINE에서 봇에게 메시지를 보내 보세요.

2. **Render 로그 확인**  
   Render 대시보드 → 해당 서비스 → **Logs**.  
   - 메시지 보낼 때 `[웹훅] 수신 body_len=...` 가 안 보이면 → LINE이 우리 서버로 요청을 안 보내는 것. **Webhook URL**이 정확한지, **Use webhook**이 켜져 있는지 LINE Developers에서 확인.  
   - `[웹훅] 서명 오류` → **CHANNEL_SECRET**이 LINE 채널 기본 설정의 Channel secret과 일치하는지 확인.  
   - `[웹훅] 처리 중 오류` → 나오는 에러 메시지대로 환경 변수(GEMINI, SUPABASE 등) 또는 네트워크 문제 확인.

3. **LINE Developers 확인 (답장이 안 오면 여기 먼저)**  
   - **Webhook URL**을 **정확히** 아래처럼 넣습니다. (주소만 본인 서비스로 바꾸세요.)  
     `https://line-secretary-bot-xxxx.onrender.com/callback`  
     - 반드시 **https**  
     - 끝에 **/callback** 포함 (또는 `/webhook` 둘 다 동작)  
     - 오타 없이 (예: onrender.com, 렌더 주소 맞는지)  
   - **Webhook** 설정을 **Use** 로 켜둡니다.  
   - **Verify** 버튼 눌러서 **성공** 나오는지 확인합니다.  
   - **Render 로그**에서 메시지 보낼 때 `[요청] POST /callback` 이 안 보이면 → LINE이 우리 서버로 요청을 안 보내는 것. 위 URL과 Use 설정을 다시 확인합니다.

4. **브라우저는 OK인데 답장·Supabase에 안 들어갈 때**  
   - `https://본인서비스.onrender.com/debug/env` 접속 → 모든 값이 `ok`인지 확인. 하나라도 비어있으면 Render **Environment**에서 해당 키 추가.  
   - LINE에서 메시지 보낸 **직후** Render **Logs** 확인:  
     - `[요청] POST /callback` 없음 → LINE이 이 서버로 안 보냄. 웹훅 URL·Use 다시 확인.  
     - `[요청] POST /callback` 있음 + `[웹훅] 서명 오류` → CHANNEL_SECRET을 LINE 채널의 Channel secret과 동일하게 다시 입력.  
     - `[웹훅] 서명 검증 통과` 다음에 `처리 오류` → 로그에 찍힌 에러 메시지로 원인 확인 (Gemini, Supabase 등).

## 5. 서버 실행 명령어 정리

- **Render (배포)**  
  `uvicorn main:app --host 0.0.0.0 --port $PORT`  
  (Render가 `PORT`를 넣어줌)

- **로컬**  
  `python main.py`  
  또는  
  `uvicorn main:app --host 0.0.0.0 --port 8000`  
  (기본 8000, `PORT` 환경 변수 있으면 그 값 사용)
