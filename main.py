"""
LINE 일정 관리 비서 봇
메시지 수신 → Gemini로 분석(원자화) → Supabase chats + tasks 테이블 저장
조회 요청 시 Supabase에서 일정/업무 요약 답장
"""
import base64
import hashlib
import hmac
import json
import os
import re
from datetime import date, datetime, timedelta

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Request
from linebot.v3 import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    ApiClient,
    Configuration,
    MessagingApi,
    ReplyMessageRequest,
    TextMessage,
)
from linebot.v3.webhooks import Event, FollowEvent, JoinEvent, MessageEvent, TextMessageContent
import requests
from google import genai
from google.genai import errors as genai_errors

load_dotenv()

# LINE (환경 변수 앞뒤 공백/줄바꿈 제거 - Render 등에서 복붙 시 실패 방지)
CHANNEL_SECRET = (os.getenv("CHANNEL_SECRET") or "").strip()
CHANNEL_ACCESS_TOKEN = (os.getenv("CHANNEL_ACCESS_TOKEN") or "").strip()
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


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """모든 요청 로그 (LINE POST 오는지 확인용)."""
    method = request.method
    path = request.url.path
    print(f"[요청] {method} {path}", flush=True)
    if method == "POST" and path in ("/callback", "/webhook"):
        print(">>> LINE 웹훅 POST 도착 <<<", flush=True)
    response = await call_next(request)
    return response

gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# 일정/할일 분석용 프롬프트 (구 레거시)
GEMINI_PROMPT_TEMPLATE = """다음 메시지를 일정·할일·비서 관점에서 짧게 분석해줘. 
일정/시간/할일이 있으면 요약하고, 없으면 "일반 대화" 등 한 줄로 분류해줘. 
한국어로 1~3문장 이내로 답해줘.

메시지: {message}
"""

# 등록 병원/고객명 (정규화용). 지정된 이름이 아니면 "기타"
HOSPITAL_CANONICAL = frozenset({
    "Jy", "Clyve", "Thebb", "our", "Delp", "EverB", "Seoulartline", "will", "Kleam",
    "Lacela", "DerAan", "Renovo", "Glory", "harmony", "Mi-k", "MYCELL", "AIDA", "삼성",
    "Korean Diet",
})
# 사용자 발화 → 저장용 정규명 매핑 (소문자/공백 제거 후 매칭용)
HOSPITAL_ALIASES = {
    "제이와이": "Jy", "제이와이의원": "Jy", "jy": "Jy",
    "마이셀": "MYCELL", "마이셀의원": "MYCELL", "mycell": "MYCELL",
    "클라이브": "Clyve", "clyve": "Clyve",
    "델프": "Delp", "delp": "Delp",
    "테브": "Thebb", "thebb": "Thebb",
    "에버비": "EverB", "everb": "EverB",
    "서울아트라인": "Seoulartline", "seoulartline": "Seoulartline",
    "클램": "Kleam", "kleam": "Kleam",
    "라셀라": "Lacela", "lacela": "Lacela",
    "레노보": "Renovo", "renovo": "Renovo",
    "글로리": "Glory", "glory": "Glory",
    "하모니": "harmony", "harmony": "harmony",
    "미케이": "Mi-k", "mi-k": "Mi-k", "mik": "Mi-k",
    "더안": "DerAan", "deraan": "DerAan",
    "코리안다이어트": "Korean Diet", "koreandiet": "Korean Diet", "korean diet": "Korean Diet",
}

def _normalize_hospital(name: str | None) -> str:
    """병원명 정규화: 별칭이면 등록명으로, 등록명이면 그대로, 아니면 '기타'."""
    if not name or not isinstance(name, str):
        return "기타"
    s = name.strip()
    if not s:
        return "기타"
    key = s.replace(" ", "").lower()
    canonical = HOSPITAL_ALIASES.get(s) or HOSPITAL_ALIASES.get(key)
    if canonical:
        return canonical
    # 대소문자만 다른 등록명
    for h in HOSPITAL_CANONICAL:
        if h.lower() == key or h == s:
            return h
    return "기타"


# 5대 업무유형 (통제소 정규화)
TASK_TYPE_CATEGORIES = (
    "광고/마케팅",
    "콘텐츠/디자인",
    "고객/예약(CS)",
    "경영/행정",
    "플랫폼/IT",
)

# 원자화: 메시지에서 업무만 추출. JSON은 반드시 tasks 배열만 포함 (요약문/설명 없이 Task 데이터만)
GEMINI_EXTRACT_PROMPT = """당신은 업무 추출 API입니다. 출력은 반드시 아래 형식의 JSON 하나만 하세요. 설명·마크다운·코드블록·줄바꿈 요약문 금지.

중요: 메시지에 나온 업무·일정·할일을 **빠짐없이** 각각 개별 task로 추출하세요. 여러 건이면 모두 나열하고, 합치거나 생략하지 마세요.

오늘 날짜: {today_ymd} ({today_weekday})

출력 형식 (다른 텍스트 없이 이 JSON만):
{{"tasks":[ ... ]}}

각 task 객체 필수 키 5개 (빈 값 금지):
- title: 핵심 키워드만 3~7단어 (예: "메타 페이지 개설", "예산 증액", "세금계산서 발행")
- hospital_name: 아래 목록에서 메시지에 나온 곳만 사용. 없으면 "기타".
  목록: Jy, Clyve, Thebb, our, Delp, EverB, Seoulartline, will, Kleam, Lacela, DerAan, Renovo, Glory, harmony, Mi-k, MYCELL, Korean Diet
  별칭: "제이와이"→Jy, "마이셀"→MYCELL, "클라이브"→Clyve, "코리안다이어트" 또는 "Korean Diet" 언급 시 반드시 hospital_name="Korean Diet"로 설정. 기타로 두지 마세요.
- task_type: 반드시 아래 5개 중 하나만 사용. 다른 값 금지. 모르면 "경영/행정".
  1) 광고/마케팅 (메타광고, 예산증액, 성과보고 등)
  2) 콘텐츠/디자인 (번역, 캡션수정, 해시태그, 배너제작 등)
  3) 고객/예약(CS) (VIP예약, 통역사 섭외, 컴플레인 대처 등)
  4) 경영/행정 (세금계산서, 법인카드, 정산, 인플루언서 계약 등)
  5) 플랫폼/IT (AIDA, SyncBridge, 닥터리무진 앱, 버그 수정 등)
- deadline: "내일","모레","다음 주 O요일" 등 있으면 오늘({today_ymd}) 기준 YYYY-MM-DD. 없으면 null.
- description: 해당 업무 한 줄 설명 (필수, 빈 문자열 금지).

실제 업무가 하나도 없으면 tasks: [] 로 응답. 요약문이나 "일정·업무 요약" 같은 문장은 tasks에 넣지 마세요.

예시:
{{"tasks":[{{"title":"예산 증액","hospital_name":"MYCELL","task_type":"광고/마케팅","deadline":"{today_ymd}","description":"마이셀 메타 광고 예산 증액"}},{{"title":"세금계산서 발행","hospital_name":"Clyve","task_type":"경영/행정","deadline":null,"description":"Clyve 3월분 세금계산서 발행"}}]}}

메시지:
{message}
"""


def _fallback_extract_from_message(text: str) -> dict:
    """메시지에서 병원명·마감 추출 (Gemini 실패 시 fallback 1건용). 병원명은 별칭→정규명 변환."""
    today = date.today()
    hospital = None
    deadline = None
    for alias, canonical in HOSPITAL_ALIASES.items():
        if alias in text or canonical in text:
            hospital = canonical
            break
    if not hospital:
        for m in re.finditer(r"([A-Za-z가-힣0-9]+)\s*(?:의원|병원|원장|플랫폼|팀)", text):
            raw = (m.group(1) or "").strip()
            if raw:
                hospital = _normalize_hospital(raw)
                if hospital != "기타":
                    break
    if not hospital:
        for h in HOSPITAL_CANONICAL:
            if h in text:
                hospital = h
                break
    if not hospital:
        hospital = "기타"
    if "내일" in text:
        deadline = (today + timedelta(days=1)).strftime("%Y-%m-%d")
    elif "모레" in text:
        deadline = (today + timedelta(days=2)).strftime("%Y-%m-%d")
    elif "오늘" in text:
        deadline = today.strftime("%Y-%m-%d")
    return {"hospital_name": hospital, "task_type": "경영/행정", "deadline": deadline}


def _resolve_relative_date(relative_str: str, base: date) -> str | None:
    """'내일','모레','다음 주 월요일' 등을 base 기준 YYYY-MM-DD로 변환."""
    if not relative_str or not isinstance(relative_str, str):
        return None
    s = relative_str.strip()
    if not s:
        return None
    # 이미 YYYY-MM-DD 형태면 그대로
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    day_names = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]
    weekday_map = {name: (i + 1) % 7 for i, name in enumerate(day_names)}  # 월=1, ..., 일=0
    s_lower = s.replace(" ", "")
    if "내일" in s_lower or s_lower == "내일":
        return (base + timedelta(days=1)).strftime("%Y-%m-%d")
    if "모레" in s_lower or s_lower == "모레":
        return (base + timedelta(days=2)).strftime("%Y-%m-%d")
    if "오늘" in s_lower or s_lower == "오늘":
        return base.strftime("%Y-%m-%d")
    for name in day_names:
        if name in s and ("다음주" in s_lower or "다음 주" in s):
            w = weekday_map.get(name)
            if w is not None:
                base_w = (base.weekday() + 1) % 7  # 월=1, ..., 일=0
                days_ahead = (w - base_w + 7) % 7
                if days_ahead == 0:
                    days_ahead = 7
                return (base + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    return None


def _call_gemini(prompt: str) -> str:
    candidates = []
    for m in [GEMINI_MODEL, "models/gemini-2.0-flash", "models/gemini-flash-latest", "models/gemini-pro-latest"]:
        if m and m not in candidates:
            candidates.append(m)
    last_err: Exception | None = None
    for model in candidates:
        try:
            response = gemini_client.models.generate_content(model=model, contents=prompt)
            text_out = getattr(response, "text", None)
            return (text_out or "").strip()
        except Exception as e:
            last_err = e
            continue
    return f"(Gemini 오류: {last_err})"


def analyze_with_gemini(text: str) -> str:
    """Gemini로 메시지 분석 후 분석 결과 문자열 반환."""
    return _call_gemini(GEMINI_PROMPT_TEMPLATE.format(message=text))


TASK_TYPES_ALLOWED = frozenset(TASK_TYPE_CATEGORIES)


_WEEKDAY_KO = ("월", "화", "수", "목", "금", "토", "일")


# 상태는 오직 두 가지: 지시 대기 / 지시 완료 (대시보드에서 담당자 지정 시 지시 완료로 전환)
def _infer_status(_title: str, _desc: str, _deadline_ymd: str | None, _today: date) -> str:
    """신규 업무는 항상 지시 대기. 담당자 지정 시 대시보드에서 지시 완료로 변경됨."""
    return "지시 대기"


def analyze_and_extract(text: str) -> tuple[str, list[dict]]:
    """Gemini로 메시지 분석 후 summary와 개별 업무 리스트 반환. 병원명 정규화·빈 행 제거."""
    today = date.today()
    today_ymd = today.strftime("%Y-%m-%d")
    today_weekday = _WEEKDAY_KO[today.weekday()]
    default_summary = text[:50].strip() if text else "업무"
    default_tasks: list[dict] = []
    try:
        raw = _call_gemini(
            GEMINI_EXTRACT_PROMPT.format(today_ymd=today_ymd, today_weekday=today_weekday, message=text)
        )
    except Exception as e:
        print(f"[analyze_and_extract] Gemini 호출 실패: {e}", flush=True)
        return default_summary, default_tasks
    raw = (raw or "").strip()
    try:
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```\s*$", "", raw)
        json_match = re.search(r"\{[\s\S]*\}", raw)
        if not json_match:
            return default_summary, default_tasks
        data = json.loads(json_match.group())
        if not isinstance(data, dict):
            return default_summary, default_tasks
        raw_tasks = data.get("tasks") if isinstance(data.get("tasks"), list) else []
        tasks = []
        for t in raw_tasks:
            if not isinstance(t, dict):
                continue
            desc = (t.get("description") or t.get("title") or "").strip()
            title = (t.get("title") or "").strip()
            if not desc and title:
                desc = title
            # 빈 행 방지: description 없으면 이 task는 저장하지 않음
            if not desc or not desc.replace("\n", " ").strip():
                continue
            if not title or re.search(r"일정\s*·?\s*업무\s*요약|업무\s*요약", (title or "")):
                candidate = re.sub(r"일정\s*·?\s*업무\s*요약|업무\s*요약", "", desc).strip()
                candidate = re.sub(r"^(이번\s*주|이번주|해야\s*할|하고\s*|있습니다|합니다|해\s*요|돼)\s*", "", candidate, flags=re.I).strip()
                title = (candidate[:20] if len(candidate) > 20 else candidate).strip() or "업무"
            def _str_or_none(v) -> str | None:
                if v is None:
                    return None
                if isinstance(v, str):
                    return v.strip() or None
                return str(v).strip() or None
            hospital = _normalize_hospital(_str_or_none(t.get("hospital_name")))
            if "코리안다이어트" in text.lower() or "korean diet" in text.lower():
                hospital = "Korean Diet"
            task_type_val = _str_or_none(t.get("task_type"))
            if not task_type_val or task_type_val not in TASK_TYPES_ALLOWED:
                task_type_val = "경영/행정"
            deadline = _str_or_none(t.get("deadline"))
            if deadline and not re.match(r"^\d{4}-\d{2}-\d{2}$", deadline or ""):
                resolved = _resolve_relative_date(deadline, today)
                if resolved:
                    deadline = resolved
            tasks.append({
                "title": title[:200],
                "description": (desc[:300] if len(desc) > 300 else desc),
                "hospital_name": hospital,
                "task_type": task_type_val,
                "deadline": deadline,
            })
        summary = default_summary
        if tasks:
            summary = f"업무 {len(tasks)}건"
        return summary, tasks
    except (json.JSONDecodeError, TypeError, ValueError, KeyError, AttributeError) as e:
        print(f"[analyze_and_extract] 파싱/추출 오류: {e}", flush=True)
        return default_summary, default_tasks


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
) -> str | None:
    """Supabase chats 테이블에 한 행 삽입. 삽입된 행의 id 반환."""
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
        "Prefer": "return=representation",
    }
    resp = requests.post(url, headers=headers, json=row, timeout=15)
    if resp.status_code >= 400:
        raise RuntimeError(f"Supabase insert failed: {resp.status_code} {resp.text}")
    data = resp.json()
    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict) and "id" in data[0]:
        return str(data[0]["id"])
    return None


def _tasks_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def insert_one_task_row(
    *,
    chat_id: str | None,
    line_user_id: str | None,
    line_group_id: str | None,
    source_message: str,
    description: str,
    title: str | None = None,
) -> None:
    """tasks 테이블에 정확히 1건만 삽입 (메시지당 최소 1건 보장용). 실패 시 예외."""
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/tasks"
    desc = (description or source_message or "업무 내용")[:500].strip() or "업무 내용"
    title_str = (title or desc[:50] or "업무").strip()
    if re.search(r"일정\s*·?\s*업무\s*요약|업무\s*요약", title_str):
        title_str = (desc[:20] if len(desc) > 20 else desc).strip() or "업무"
    status_val = _infer_status(title_str, desc, None, date.today())
    row = {
        "chat_id": chat_id,
        "line_user_id": line_user_id,
        "line_group_id": line_group_id,
        "source_message": source_message,
        "title": title_str,
        "description": desc,
        "hospital_name": None,
        "task_type": None,
        "status": status_val,
        "deadline": None,
    }
    resp = requests.post(url, headers=_tasks_headers(), json=row, timeout=15)
    if resp.status_code >= 400:
        print(f"[tasks 1건 insert 실패] {resp.status_code} {resp.text}", flush=True)
        raise RuntimeError(f"tasks insert failed: {resp.status_code} {resp.text[:300]}")
    print(f"[tasks] 1건 insert 성공", flush=True)


def save_tasks_to_supabase(
    *,
    chat_id: str | None,
    line_user_id: str | None,
    line_group_id: str | None,
    source_message: str,
    tasks: list[dict],
) -> None:
    """Supabase tasks 테이블에 업무 단위로 행 삽입. 빈 title/description 행은 저장하지 않음."""
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/tasks"

    def insert_one(row: dict) -> None:
        resp = requests.post(url, headers=_tasks_headers(), json=row, timeout=15)
        if resp.status_code >= 400:
            print(f"[tasks insert 실패] {resp.status_code} {resp.text}", flush=True)
            raise RuntimeError(f"tasks insert failed: {resp.status_code} {resp.text[:200]}")

    for t in tasks:
        desc = (t.get("description") or t.get("title") or "").strip()
        if not desc or not desc.replace("\n", " ").strip():
            continue
        title_str = (t.get("title") or desc[:50] or "").strip() or desc[:20]
        if not title_str or re.search(r"일정\s*·?\s*업무\s*요약|업무\s*요약", title_str):
            title_str = (desc[:20] if len(desc) > 20 else desc).strip() or "업무"
        if not title_str:
            continue
        hospital = (t.get("hospital_name") or "").strip() or "기타"
        hospital = _normalize_hospital(hospital) if hospital != "기타" else "기타"
        task_type = (t.get("task_type") or "").strip() or "경영/행정"
        if task_type not in TASK_TYPES_ALLOWED:
            task_type = "경영/행정"
        deadline = t.get("deadline") or None
        deadline_ymd: str | None = None
        if deadline and isinstance(deadline, str) and len(deadline.strip()) == 10:
            deadline_ymd = deadline.strip()
            deadline = f"{deadline_ymd}T23:59:59Z"
        status_val = _infer_status(title_str, desc, deadline_ymd, date.today())
        row = {
            "chat_id": chat_id,
            "line_user_id": line_user_id,
            "line_group_id": line_group_id,
            "source_message": source_message,
            "title": title_str,
            "description": desc,
            "hospital_name": hospital,
            "task_type": task_type,
            "status": status_val,
            "deadline": deadline,
        }
        insert_one(row)


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


# 일정 조회 요청으로 볼 키워드 (짧은 메시지일 때만)
SCHEDULE_QUERY_KEYWORDS = ("일정", "약속", "정리해", "뭐야", "있어", "알려", "보여", "확인")
# 미완료 업무 조회 요청
TASK_QUERY_KEYWORDS = ("할일", "해야", "업무", "미완료", "todo", "해야 할", "해야할", "과제", "뭐 해야")
# 일정으로 분류할 분석/메시지 키워드 (대시보드와 동일)
SCHEDULE_CONTENT_KEYWORDS = (
    "일정", "회의", "약속", "미팅", "예약", "날짜", "오전", "오후", "시", "캘린더",
    "내일", "모레", "다음 주", "다음주", "회의실", "화상",
)
TASK_CONTENT_KEYWORDS = (
    "할일", "해야", "업무", "미완료", "todo", "해야 할", "해야할", "과제", "제출", "마감",
)
# 일정/업무가 아닌 일반 대화로 볼 패턴 (저장 안내만 하고 "저장했어요" 하지 않음)
CASUAL_CHAT_KEYWORDS = (
    "test", "테스트", "대답해", "봇", "안녕", "ㅋ", "ㅎ", "응", "네", "뭐해", "뭐 해",
    "그래", "알겠", "??", "?", "!", "ㅇ", "ㅂ", "ㄱ", "ㄴ", "오케이", "ok", "okay",
)


def is_likely_task_or_schedule(text: str) -> bool:
    """일정/업무 성격 메시지인지 판별. False면 '저장했어요' 대신 안내만 함."""
    t = (text or "").strip()
    if len(t) <= 2:
        return False
    lower = t.lower()
    # 짧은 메시지(20자 이하)인데 일정/업무 관련 키워드 없으면 일반 대화
    task_schedule_keywords = SCHEDULE_CONTENT_KEYWORDS + TASK_CONTENT_KEYWORDS
    has_keyword = any(k in t or k in lower for k in task_schedule_keywords)
    if len(t) <= 20 and not has_keyword:
        if any(c in t or c in lower for c in CASUAL_CHAT_KEYWORDS):
            return False
        # 숫자·날짜 느낌 없고 짧으면 대화로 간주 (예: "test", "비서봇 대답해봐")
        if len(t) <= 15:
            return False
    return True


def is_schedule_query(text: str) -> bool:
    """일정/약속 조회 요청인지 판별."""
    t = text.strip()
    if len(t) > 60:
        return False
    return any(k in t for k in SCHEDULE_QUERY_KEYWORDS)


def is_task_query(text: str) -> bool:
    """미완료 업무 조회 요청인지 판별."""
    t = text.strip()
    if len(t) > 60:
        return False
    return any(k in t for k in TASK_QUERY_KEYWORDS)


def fetch_chats_from_supabase(limit: int = 50) -> list[dict]:
    """Supabase chats 최근 N건 조회."""
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/chats"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    params = {
        "select": "raw_message,gemini_analysis,created_at",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    resp = requests.get(url, headers=headers, params=params, timeout=15)
    if resp.status_code >= 400:
        return []
    data = resp.json()
    return data if isinstance(data, list) else []


def fetch_tasks_from_supabase(limit: int = 100) -> list[dict]:
    """Supabase tasks 테이블에서 최근 N건 조회."""
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/tasks"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    params = {
        "select": "id,chat_id,title,description,hospital_name,task_type,status,deadline,created_at",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    resp = requests.get(url, headers=headers, params=params, timeout=15)
    if resp.status_code >= 400:
        return []
    data = resp.json()
    return data if isinstance(data, list) else []


def filter_schedule_rows(rows: list[dict]) -> list[dict]:
    """일정 관련 행만 필터."""
    out = []
    for r in rows:
        combined = ((r.get("gemini_analysis") or "") + " " + (r.get("raw_message") or "")).lower()
        if any(k in combined for k in SCHEDULE_CONTENT_KEYWORDS):
            out.append(r)
    return out


def filter_task_rows(rows: list[dict]) -> list[dict]:
    """미완료 업무 관련 행만 필터."""
    out = []
    for r in rows:
        combined = ((r.get("gemini_analysis") or "") + " " + (r.get("raw_message") or "")).lower()
        if any(k in combined for k in TASK_CONTENT_KEYWORDS):
            out.append(r)
    return out


def format_schedule_reply(rows: list[dict], max_len: int = 4500) -> str:
    """LINE 메시지 길이 제한에 맞춰 일정 요약 문자열 생성."""
    if not rows:
        return "📅 아직 저장된 일정이 없어요. 채팅에서 일정을 말해 주시면 저장해 둘게요."
    lines = ["📅 저장된 일정이에요.\n"]
    for r in rows[:20]:
        msg = (r.get("raw_message") or "").strip()
        if not msg:
            continue
        created = r.get("created_at") or ""
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            time_str = dt.strftime("%m/%d %H:%M")
        except Exception:
            time_str = created[:16] if created else ""
        lines.append(f"• {msg}")
        if time_str:
            lines.append(f"  ({time_str})")
    text = "\n".join(lines)
    return text[:max_len] + ("..." if len(text) > max_len else "")


def format_task_reply(rows: list[dict], max_len: int = 4500) -> str:
    """LINE 메시지 길이 제한에 맞춰 미완료 업무 요약 문자열 생성. (tasks 테이블 행 또는 레거시 chat 행)"""
    if not rows:
        return "📋 아직 수집된 미완료 업무가 없어요. 할 일을 채팅에 말해 주시면 저장해 둘게요."
    lines = ["📋 미완료 업무예요.\n"]
    for r in rows[:20]:
        title = (r.get("description") or r.get("title") or r.get("raw_message") or "").strip()
        if not title:
            continue
        hospital = (r.get("hospital_name") or "").strip()
        task_type = (r.get("task_type") or "").strip()
        deadline = (r.get("deadline") or "").strip()[:10]
        status = (r.get("status") or "").strip()
        parts = [title]
        if hospital:
            parts.append(f"[{hospital}]")
        if task_type:
            parts.append(f"({task_type})")
        if deadline:
            parts.append(f"마감 {deadline}")
        if status:
            parts.append(f"- {status}")
        lines.append("• " + " ".join(parts))
    text = "\n".join(lines)
    return text[:max_len] + ("..." if len(text) > max_len else "")


@handler.add(JoinEvent)
def handle_join(_event: JoinEvent):
    """봇이 그룹/단체방에 초대되었을 때. 답장 없이 200만 반환(답장 시 오류/지연 시 퇴장할 수 있어서 제거)."""
    print("[웹훅] JoinEvent 수신 (그룹/단체방 초대)", flush=True)


@handler.add(FollowEvent)
def handle_follow(event: FollowEvent):
    """봇을 친구 추가했을 때 (1:1 채팅)."""
    try:
        print("[웹훅] FollowEvent 수신 (친구 추가)", flush=True)
        token = getattr(event, "reply_token", None)
        if token:
            reply_to_line(token, "친구 추가해 주셔서 감사해요. 일정·업무를 말씀해 주시면 저장해 드릴게요.")
    except Exception as e:
        print(f"[웹훅] FollowEvent 처리 중 오류: {e}", flush=True)


@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event: MessageEvent):
    """텍스트 수신: 조회 요청이면 일정/업무 요약 답장, 아니면 분석·저장 후 답장."""
    user_id = getattr(event.source, "user_id", None)
    group_id = getattr(event.source, "group_id", None)
    text = (event.message.text or "").strip()

    # 미완료 업무 조회 요청 (tasks 테이블 우선)
    if is_task_query(text):
        try:
            task_rows = fetch_tasks_from_supabase(limit=80)
            if not task_rows:
                chat_rows = fetch_chats_from_supabase(limit=80)
                task_rows = filter_task_rows(chat_rows)
            reply_text = format_task_reply(task_rows)
            reply_to_line(event.reply_token, reply_text)
        except Exception as e:
            print(f"[업무 조회 실패] {e}")
            reply_to_line(event.reply_token, "미완료 업무를 불러오다 오류가 났어요. 잠시 후 다시 시도해 주세요.")
        return

    # 일정/약속 조회 요청
    if is_schedule_query(text):
        try:
            rows = fetch_chats_from_supabase(limit=80)
            schedule_rows = filter_schedule_rows(rows)
            reply_text = format_schedule_reply(schedule_rows)
            reply_to_line(event.reply_token, reply_text)
        except Exception as e:
            print(f"[일정 조회 실패] {e}")
            reply_to_line(event.reply_token, "일정을 불러오다 오류가 났어요. 잠시 후 다시 시도해 주세요.")
        return

    # 일정/업무 성격이 아닌 일반 대화 → 저장하지 않고 답장도 하지 않음
    if not is_likely_task_or_schedule(text):
        return

    # 일반 메시지(일정·업무 성격): Gemini 원자화 분석 → chats + tasks 저장 → 답장
    print(f"[웹훅] 일반 메시지 처리 시작 text_len={len(text)}", flush=True)
    summary, tasks = analyze_and_extract(text)
    has_valid = any((t.get("description") or t.get("title") or "").strip() for t in tasks) if tasks else False
    if not has_valid:
        fallback_desc = (summary[:200] if summary and not summary.startswith("(Gemini") else text[:200].strip()) or "업무 내용"
        fallback_title = (summary[:30] if summary and "일정·업무" not in summary else text[:30].strip()) or "업무"
        extracted = _fallback_extract_from_message(text)
        tasks = [{
            "title": fallback_title,
            "description": fallback_desc,
            "hospital_name": extracted.get("hospital_name") or "기타",
            "task_type": extracted.get("task_type") or "경영/행정",
            "deadline": extracted.get("deadline"),
        }]
    try:
        chat_id = save_to_supabase(
            line_user_id=user_id,
            line_group_id=group_id,
            raw_message=text,
            gemini_analysis=summary,
        )
        print(f"[저장] chats OK chat_id={chat_id}", flush=True)
        save_tasks_to_supabase(
            chat_id=chat_id,
            line_user_id=user_id,
            line_group_id=group_id,
            source_message=text,
            tasks=tasks,
        )
        print(f"[저장] tasks OK {len(tasks)}건, 답장 전송", flush=True)
        if len(tasks) > 1:
            reply_to_line(event.reply_token, f"일정·업무 {len(tasks)}건 저장했어요.")
        else:
            reply_to_line(event.reply_token, "일정·업무 저장했어요.")
    except Exception as e:
        import traceback
        print(f"[저장 실패] user={user_id}, group={group_id}, err={e}", flush=True)
        traceback.print_exc()
        reply_to_line(event.reply_token, "저장 중 오류가 났어요. 잠시 후 다시 시도해 주세요.")


@handler.add(Event)
def handle_other_events(_event: Event):
    """이미지·스티커·멤버 참여/나감 등 미처리 이벤트. 예외 방지로 200 반환 → 특정 대화방에서만 봇 퇴장 방지."""
    pass


@app.post("/debug/insert")
async def debug_insert():
    """Supabase 연결 확인용: 테스트 데이터 삽입 (chats + tasks)."""
    text = "Clyve 의원 리포트 마감 내일, 삼성 병원 미팅 다음 주 수요일"
    summary, tasks = analyze_and_extract(text)
    chat_id = save_to_supabase(
        line_user_id="debug-user",
        line_group_id=None,
        raw_message=text,
        gemini_analysis=summary,
    )
    has_valid = any((t.get("description") or t.get("title") or "").strip() for t in tasks) if tasks else False
    if not has_valid:
        extracted = _fallback_extract_from_message(text)
        tasks = [{"title": summary[:30] or text[:30], "description": text[:200], "hospital_name": extracted.get("hospital_name") or "기타", "task_type": extracted.get("task_type") or "경영/행정", "deadline": extracted.get("deadline")}]
    save_tasks_to_supabase(chat_id=chat_id, line_user_id="debug-user", line_group_id=None, source_message=text, tasks=tasks)
    return {"status": "ok", "summary": summary, "tasks_count": len(tasks)}


@app.get("/debug/gemini-models")
async def debug_gemini_models():
    """Gemini 모델명 확인용. (지원 모델이 404로 막힐 때 사용)"""
    return {"models": list_gemini_generate_models()}


@app.get("/")
async def root():
    return {"status": "ok", "message": "LINE Secretary Bot"}


@app.get("/ping")
async def ping():
    """슬립 방지용. UptimeRobot·cron-job.org 등에서 10~14분 간격으로 호출."""
    return {"ok": True}


@app.get("/debug/env")
async def debug_env():
    """Render 환경 변수 설정 여부만 확인 (값 노출 안 함)."""
    return {
        "CHANNEL_SECRET": "ok" if (CHANNEL_SECRET and len(CHANNEL_SECRET) > 5) else "비어있거나 짧음",
        "CHANNEL_ACCESS_TOKEN": "ok" if (CHANNEL_ACCESS_TOKEN and len(CHANNEL_ACCESS_TOKEN) > 10) else "비어있거나 짧음",
        "GEMINI_API_KEY": "ok" if (GEMINI_API_KEY and len(GEMINI_API_KEY) > 5) else "비어있거나 짧음",
        "SUPABASE_URL": "ok" if (SUPABASE_URL and SUPABASE_URL.startswith("http")) else "비어있거나 잘못됨",
        "SUPABASE_KEY": "ok" if (SUPABASE_KEY and len(SUPABASE_KEY) > 10) else "비어있거나 짧음",
    }


@app.get("/debug/webhook-url")
async def debug_webhook_url(request: Request):
    """LINE Developers에 넣을 Webhook URL (이 요청이 도달한 주소 기준)."""
    host = request.headers.get("host", "본인서비스.onrender.com")
    url = f"https://{host}/callback"
    return {
        "line_webhook_url": url,
        "설명": "LINE Developers → 본인 채널 → Messaging API 탭 → Webhook URL에 위 line_webhook_url 을 그대로 복사해서 넣으세요.",
    }


@app.get("/callback")
async def callback_get(request: Request):
    """LINE Verify 등 GET 요청용. 웹훅은 POST만 처리."""
    return {"status": "ok", "message": "Use POST for webhook"}


def _verify_line_signature(body: str, signature: str, secret: str) -> bool:
    """LINE 웹훅 서명 검증 (HMAC-SHA256 + base64). 헤더에 여러 서명(쉼표 구분)이 올 수 있음."""
    secret = (secret or "").strip()
    if not signature or not secret:
        return False
    gen = base64.b64encode(
        hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8")
    for s in signature.split(","):
        if hmac.compare_digest(gen, s.strip()):
            return True
    return hmac.compare_digest(gen, signature.strip())


def _run_webhook_handler(body_str: str, signature: str) -> None:
    """백그라운드에서 실행. 예외 나도 로그만 하고 끝 (이미 200 반환됨)."""
    try:
        handler.handle(body_str, signature)
        print("[웹훅] 백그라운드 처리·답장 완료", flush=True)
    except Exception as e:
        import traceback
        print(f"[웹훅] 백그라운드 처리 오류: {e}", flush=True)
        traceback.print_exc()


def _webhook_events_are_join_only(body_str: str) -> bool:
    """웹훅이 join(또는 leave/follow/unfollow)만 포함하면 True. SDK 호출 없이 200만 반환하기 위함."""
    try:
        data = json.loads(body_str)
        events = data.get("events")
        if not events or not isinstance(events, list):
            return False
        for ev in events:
            if not isinstance(ev, dict):
                return False
            t = ev.get("type")
            if t not in ("join", "leave", "follow", "unfollow"):
                return False
        return True
    except (json.JSONDecodeError, TypeError, KeyError):
        return False


def _log_join_leave_events(body_str: str) -> None:
    """join/leave 관련 이벤트는 SDK 없이도 핵심 정보만 로그로 남긴다 (문제 대화방 식별용)."""
    try:
        data = json.loads(body_str)
        events = data.get("events")
        if not events or not isinstance(events, list):
            return
        for ev in events:
            if not isinstance(ev, dict):
                continue
            t = ev.get("type")
            if t not in ("join", "leave"):
                continue
            src = ev.get("source") if isinstance(ev.get("source"), dict) else {}
            src_type = (src.get("type") or "").strip()
            gid = (src.get("groupId") or "").strip()
            rid = (src.get("roomId") or "").strip()
            wid = (ev.get("webhookEventId") or "").strip()
            mode = (ev.get("mode") or "").strip()
            print(
                f"[웹훅] {t} event src_type={src_type} groupId={gid or '-'} roomId={rid or '-'} mode={mode or '-'} webhookEventId={wid or '-'}",
                flush=True,
            )
    except Exception:
        return


async def _handle_line_webhook(request: Request, background_tasks: BackgroundTasks):
    # LINE은 1~2초 안에 응답 없으면 타임아웃 → 봇 퇴장. 항상 즉시 200 반환.
    signature = request.headers.get("X-Line-Signature", "")
    body = await request.body()
    body_str = body.decode("utf-8")
    print(f"[웹훅] 수신 body_len={len(body_str)}, signature={'있음' if signature else '없음'}", flush=True)

    if not _verify_line_signature(body_str, signature, CHANNEL_SECRET or ""):
        print("[웹훅] 서명 오류 (200 반환하여 봇 퇴장 방지, 처리 생략)", flush=True)
        return {"status": "ok"}

    # Join(봇 그룹 초대) 이벤트는 SDK 거치지 않고 즉시 200만 반환. SDK 예외/지연으로 퇴장 방지.
    if _webhook_events_are_join_only(body_str):
        _log_join_leave_events(body_str)
        print("[웹훅] Join(또는 leave/follow/unfollow) 전용 → SDK 호출 없이 200 즉시 반환", flush=True)
        return {"status": "ok"}

    print("[웹훅] 서명 검증 통과, 200 즉시 반환 후 백그라운드 처리", flush=True)
    background_tasks.add_task(_run_webhook_handler, body_str, signature)
    return {"status": "ok"}


@app.post("/webhook")
async def webhook(request: Request, background_tasks: BackgroundTasks):
    return await _handle_line_webhook(request, background_tasks)


@app.post("/callback")
async def callback_post(request: Request, background_tasks: BackgroundTasks):
    return await _handle_line_webhook(request, background_tasks)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
