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
