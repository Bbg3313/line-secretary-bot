# LINE 웹훅 POST가 안 올 때 (답장·Supabase 반영 안 됨)

**증상**: 브라우저에서 서비스 주소 열면 OK 나오는데, LINE 메시지 보내도 답 없고 로그에 `POST /callback` 도 안 보임.

→ **LINE이 우리 서버로 웹훅(POST) 요청을 안 보내는 상태**입니다. 아래만 순서대로 확인하세요.

---

## 1. 서버 주소 확인

1. Render 대시보드 → **line-secretary-bot** 서비스 클릭.
2. 상단 **Primary URL** 복사. 예: `https://line-secretary-bot-x6i1.onrender.com`
3. 브라우저에서 **그 주소 + `/debug/webhook-url`** 열기.  
   예: `https://line-secretary-bot-x6i1.onrender.com/debug/webhook-url`  
4. 화면에 나온 **`line_webhook_url`** 값을 복사. (끝이 `/callback` 인 주소)

---

## 2. LINE Developers에서 Webhook URL 설정

1. [LINE Developers](https://developers.line.biz/console/) 로그인.
2. **본인 봇이 사용하는 채널** 선택. (봇을 친구 추가한 그 채널)
3. **Messaging API** 탭 클릭.
4. 아래로 내려서 **Webhook settings** 찾기.
5. **Webhook URL**에 1번에서 복사한 `line_webhook_url` **그대로** 붙여넣기.  
   - 반드시 `https://`  
   - 반드시 끝에 `/callback`  
   - 주소 한 글자도 틀리면 POST가 안 옴.
6. **Verify** 클릭 → **Success** 나와야 함.
7. **Use webhook** 이 **켜져 있는지** 확인 (초록색).
8. **저장** (Edit 후 저장 버튼 있으면 누르기).

---

## 3. 채널이 맞는지 확인

- LINE 앱에서 대화하는 **그 봇**이, 위 2번에서 연 **그 채널**이어야 함.
- 채널이 여러 개면, “봇 친구 추가한 계정”이 연결된 **Messaging API 채널**에만 웹훅을 넣었는지 확인.

---

## 4. 다시 테스트

1. 브라우저에서 `https://본인서비스.onrender.com/` 한 번 열어서 서버 깨우기.
2. **1분 안에** LINE 앱에서 그 봇에게 메시지 보내기 (예: `안녕`).
3. Render **Logs** 확인:  
   - `[요청] POST /callback` 과 `>>> LINE 웹훅 POST 도착 <<<` 가 보이면 → LINE이 이제 우리 서버로 보내는 것.  
   - 여전히 안 보이면 → 1~3번 다시 확인 (주소, Messaging API 탭, Use webhook, 채널).

---

## 5. 그래도 POST가 안 오면

- LINE Developers에서 **다른 채널**을 쓰고 있진 않은지 확인.
- Webhook URL을 **한 번 지우고** 다시 `https://...onrender.com/callback` 입력 후 Verify → Use webhook 켜기.
- 브라우저에서 `https://본인서비스.onrender.com/callback` (GET) 을 열었을 때 Render 로그에 `[요청] GET /callback` 이 뜨는지 확인.  
  - GET도 안 뜨면 → 그 주소가 이 Render 서비스가 아니거나, 다른 서비스를 보고 있는 것.
