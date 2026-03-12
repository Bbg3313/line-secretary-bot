"""
LINE 일정 관리 비서 봇
메시지 수신 → Gemini로 분석 → Supabase chats 테이블 저장
"""
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from linebot.v3 import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    ApiClient,
    Configuration,
    MessagingApi,
    ReplyMessageRequest,
    TextMessage,
)
from linebot.v3.webhooks import MessageEvent, TextMessageContent
import requests
from google import genai
from google.genai import errors as genai_errors

load_dotenv()

# LINE
CHANNEL_SECRET = os.getenv("CHANNEL_SECRET")
CHANNEL_ACCESS_TOKEN = os.getenv("CHANNEL_ACCESS_TOKEN")
# Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-2.0-flash")
# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not CHANNEL_SECRET or not CHANNEL_ACCESS_TOKEN:
    raise ValueError("CHANNEL_SECRET과 CHANNEL_ACCESS_TOKEN을 .env에 설정해 주세요.")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY를 .env에 설정해 주세요.")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL과 SUPABASE_KEY를 .env에 설정해 주세요.")
if SUPABASE_URL and not (SUPABASE_URL.startswith("http://") or SUPABASE_URL.startswith("https://")):
    raise ValueError('SUPABASE_URL은 "https://xxxx.supabase.co" 형태여야 합니다. (Project Settings > API > Project URL)')

app = FastAPI(title="LINE Secretary Bot")
handler = WebhookHandler(CHANNEL_SECRET)
configuration = Configuration(access_token=CHANNEL_ACCESS_TOKEN)

gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# 일정/할일 분석용 프롬프트
GEMINI_PROMPT_TEMPLATE = """다음 메시지를 일정·할일·비서 관점에서 짧게 분석해줘. 
일정/시간/할일이 있으면 요약하고, 없으면 "일반 대화" 등 한 줄로 분류해줘. 
한국어로 1~3문장 이내로 답해줘.

메시지: {message}
"""


def analyze_with_gemini(text: str) -> str:
    """Gemini로 메시지 분석 후 분석 결과 문자열 반환."""
    prompt = GEMINI_PROMPT_TEMPLATE.format(message=text)

    # 계정/지역/권한에 따라 지원 모델이 달라 404가 날 수 있어 fallback 시도합니다.
    candidates = []
    for m in [GEMINI_MODEL, "models/gemini-2.0-flash", "models/gemini-flash-latest", "models/gemini-pro-latest"]:
        if m and m not in candidates:
            candidates.append(m)

    last_err: Exception | None = None
    for model in candidates:
        try:
            response = gemini_client.models.generate_content(
                model=model,
                contents=prompt,
            )
            text_out = getattr(response, "text", None)
            return text_out.strip() if text_out else "(분석 없음)"
        except Exception as e:
            last_err = e
            continue

    return f"(Gemini 오류: {last_err})"


def list_gemini_generate_models(limit: int = 30) -> list[str]:
    """현재 API 키로 generateContent 가능한 모델 일부를 반환."""
    out: list[str] = []
    try:
        for m in gemini_client.models.list():
            name = getattr(m, "name", None)
            actions = getattr(m, "supported_actions", None)
            if name and actions and "generateContent" in actions:
                out.append(name)
            if len(out) >= limit:
                break
    except Exception:
        return []
    return out


def save_to_supabase(
    *,
    line_user_id: str | None,
    line_group_id: str | None,
    raw_message: str,
    gemini_analysis: str,
) -> None:
    """Supabase chats 테이블에 한 행 삽입."""
    row = {
        "line_user_id": line_user_id,
        "line_group_id": line_group_id,
        "raw_message": raw_message,
        "gemini_analysis": gemini_analysis,
    }
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/chats"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    resp = requests.post(url, headers=headers, json=row, timeout=15)
    if resp.status_code >= 400:
        raise RuntimeError(f"Supabase insert failed: {resp.status_code} {resp.text}")


def reply_to_line(reply_token: str, text: str) -> None:
    """LINE으로 텍스트 답장 전송."""
    try:
        with ApiClient(configuration) as api_client:
            messaging_api = MessagingApi(api_client)
            messaging_api.reply_message(
                ReplyMessageRequest(reply_token=reply_token, messages=[TextMessage(text=text)])
            )
    except Exception as e:
        print(f"[LINE 답장 실패] {e}")


@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event: MessageEvent):
    """텍스트 수신 시 Gemini 분석 → Supabase 저장 → LINE 답장."""
    user_id = getattr(event.source, "user_id", None)
    group_id = getattr(event.source, "group_id", None)
    text = event.message.text

    analysis = analyze_with_gemini(text)
    try:
        save_to_supabase(
            line_user_id=user_id,
            line_group_id=group_id,
            raw_message=text,
            gemini_analysis=analysis,
        )
        print(f"[저장] user={user_id}, group={group_id}, 분석={analysis[:50]}...")
        reply_to_line(event.reply_token, "일정 저장했어요.")
    except Exception as e:
        print(f"[저장 실패] user={user_id}, group={group_id}, err={e}")
        reply_to_line(event.reply_token, "저장 중 오류가 났어요. 잠시 후 다시 시도해 주세요.")


@app.post("/debug/insert")
async def debug_insert():
    """Supabase 연결 확인용: 테스트 데이터 1건 삽입."""
    analysis = analyze_with_gemini("내일 오후 3시에 치과 예약 잡아줘")
    save_to_supabase(
        line_user_id="debug-user",
        line_group_id=None,
        raw_message="내일 오후 3시에 치과 예약 잡아줘",
        gemini_analysis=analysis,
    )
    return {"status": "ok"}


@app.get("/debug/gemini-models")
async def debug_gemini_models():
    """Gemini 모델명 확인용. (지원 모델이 404로 막힐 때 사용)"""
    return {"models": list_gemini_generate_models()}


@app.get("/")
async def root():
    return {"status": "ok", "message": "LINE Secretary Bot"}


async def _handle_line_webhook(request: Request):
    signature = request.headers.get("X-Line-Signature", "")
    body = await request.body()
    body_str = body.decode("utf-8")
    try:
        handler.handle(body_str, signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    return {"status": "ok"}


@app.post("/webhook")
async def webhook(request: Request):
    return await _handle_line_webhook(request)


@app.post("/callback")
async def callback(request: Request):
    return await _handle_line_webhook(request)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
