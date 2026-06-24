# 주일 성경공부 정리 자동화

벧엘교회 킨텍스장성남 구역 성경공부 정리 자동화 스킬입니다.
구역장 모임 녹음 파일을 받으면 이 스킬을 실행해 노션 페이지를 자동 생성합니다.

---

## 사전 준비 (최초 1회 설정)

다음 환경 변수를 맥북 `~/.zshrc`에 추가:

```bash
export OPENAI_API_KEY="sk-..."           # OpenAI API 키
export NOTION_TOKEN="ntn_..."            # 노션 Integration 토큰 (https://www.notion.so/my-integrations)
export NOTION_PARENT_PAGE_ID="3137733dd6f880079546dcf750aa67a6"  # 성경공부 상위 페이지 (확인 완료)
```

노션 통합(Integration)이 상위 페이지에 연결되어 있어야 합니다:
상위 페이지 열기 → 오른쪽 상단 `...` → 연결(Connect to) → Integration 선택

노션 상위 페이지 ID 확인 방법:
노션에서 해당 페이지 열기 → 오른쪽 상단 `...` → `링크 복사` → URL에서 마지막 32자리 해시값

---

## 실행 방법

1. 카톡에서 받은 음성 파일(m4a, mp3, wav 등)을 이 채팅에 첨부
2. 아래 프롬프트를 그대로 복사해서 실행 (날짜는 자동 계산됨)

---

## 실행 프롬프트

```
첨부한 음성 파일로 이번 주 벧엘교회 구역 성경공부 노션 페이지를 만들어줘.
아래 단계를 순서대로 실행해.

---

## STEP 1: 날짜 계산

오늘 날짜 기준으로 가장 최근 일요일을 계산한다.
결과 형식:
- YYYY-MM-DD (예: 2026-06-01)
- YYMM DD (예: 260601, 주보 URL용)
- 표시용: YYYY년 MM월 DD일 (예: 2026년 6월 1일)

---

## STEP 2: 음성 파일 → 텍스트 변환

OpenAI Whisper API로 첨부 음성 파일을 텍스트로 변환한다.

```python
import openai, os

client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

with open("음성파일경로", "rb") as f:
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=f,
        language="ko",
        response_format="text"
    )

print(transcript)
```

변환된 텍스트를 transcript 변수에 저장한다.

---

## STEP 3: 주보 PDF 다운로드 및 파싱

### 3-1. PDF URL 생성
STEP 1에서 계산한 날짜로 URL 생성:
`http://bethel.or.kr/wp-content/uploads/YYYY/MM/weeklyYYMMDD.pdf`

예시: `http://bethel.or.kr/wp-content/uploads/2026/06/weekly260601.pdf`

### 3-2. PDF 다운로드 및 OpenAI Files API 업로드

```python
import requests, openai, os

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
client = openai.OpenAI(api_key=OPENAI_API_KEY)

# PDF 다운로드
pdf_url = "위에서 생성한 URL"
res = requests.get(pdf_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
if res.status_code != 200:
    raise Exception(f"PDF 다운로드 실패: HTTP {res.status_code}")

# OpenAI Files API 업로드
import io
pdf_file = io.BytesIO(res.content)
pdf_file.name = "bulletin.pdf"
uploaded = client.files.create(file=pdf_file, purpose="user_data")
file_id = uploaded.id
```

### 3-3. GPT-4o로 파싱

```python
prompt = f"""이 문서는 한국 교회의 주보(주간 예배 소식지) PDF입니다.
주보 안에 있는 구역 성경공부 자료를 찾아서 아래 JSON 형식으로 추출해 주세요.
날짜 힌트: {study_date}

반환 형식:
{{
  "title": "성경공부 제목",
  "scripture_ref": "본문 성경 구절 (예: 창세기 40:1-8)",
  "scripture_text": "성경 본문 전체 텍스트",
  "introduction": "도입 설명 또는 배경 (2~4문장)",
  "hymn_open": "시작 찬양 (예: 446장 주 음성 외에는)",
  "hymn_close": "마침 찬양 (예: 304장 그 크신 하나님의 사랑)",
  "questions": [
    "첫 번째 질문",
    "두 번째 질문"
  ]
}}

- questions: 토의사항 질문 목록 (최대 10개)
- 구역 성경공부 항목이 없으면 설교 내용 기반 질문 3개 직접 생성
"""

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "file", "file": {"file_id": file_id}}
            ]
        }
    ],
    temperature=0.2,
    response_format={"type": "json_object"}
)

import json
bulletin = json.loads(response.choices[0].message.content)

# 업로드된 파일 삭제 (비용 절감)
client.files.delete(file_id)
```

---

## STEP 4: 성경공부 내용 생성

transcript(설교 녹취록)와 bulletin(주보 파싱 결과)을 결합해서 아래 항목들을 생성한다.

```python
content_prompt = f"""
벧엘교회 주일 구역 성경공부 내용을 정리해줘.

[주보에서 파싱한 정보]
제목: {bulletin['title']}
성경 본문: {bulletin['scripture_ref']}
도입: {bulletin['introduction']}
토의 질문들: {bulletin['questions']}

[설교 녹취록]
{transcript}

아래 JSON 형식으로 반환해줘:
{{
  "open_prayer": "시작기도 전문 (설교 주제를 반영한 기도문, 4~6문장)",
  "commentary": "성경 본문 해설 (설교 내용 기반, 3~5문장, 핵심 메시지 포함)",
  "qa_list": [
    {{
      "question": "질문 1",
      "answer": "설교 내용 기반 답변 (2~4문장)"
    }}
  ],
  "summary": "정리 (설교 결론 요약, 3~4문장)",
  "close_prayer": "마침기도 전문 (설교 주제 반영, 4~6문장)"
}}

- qa_list는 bulletin의 questions 순서와 동일하게 맞춰줘
- 기도문은 경어체(~하옵소서, ~하여 주시옵소서)로 작성
- 설교 녹취록에 없는 내용은 주보 내용으로 보완해줘
"""

content_response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": content_prompt}],
    temperature=0.3,
    response_format={"type": "json_object"}
)

content = json.loads(content_response.choices[0].message.content)
```

---

## STEP 5: 노션 페이지 생성

아래 템플릿 구조로 노션 페이지를 생성한다.

```python
import requests, os

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
NOTION_PARENT_PAGE_ID = os.environ["NOTION_PARENT_PAGE_ID"]

headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

def text(content, bold=False):
    return {"type": "text", "text": {"content": content}, "annotations": {"bold": bold}}

def heading1(t):
    return {"object": "block", "type": "heading_1", "heading_1": {"rich_text": [text(t)]}}

def heading2(t):
    return {"object": "block", "type": "heading_2", "heading_2": {"rich_text": [text(t)]}}

def paragraph(t, bold=False):
    if not t:
        return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": []}}
    return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": [text(t, bold)]}}

def callout(t):
    return {
        "object": "block",
        "type": "callout",
        "callout": {
            "rich_text": [text(t)],
            "icon": {"type": "emoji", "emoji": "💡"}
        }
    }

def numbered_item(t):
    return {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": [text(t)]}}

def divider():
    return {"object": "block", "type": "divider", "divider": {}}


# 토의사항 블록 생성
qa_blocks = []
for i, qa in enumerate(content["qa_list"], 1):
    qa_blocks.append(paragraph(f"{i}. {qa['question']}", bold=True))
    qa_blocks.append(paragraph(qa["answer"]))
    qa_blocks.append(paragraph(""))

page_body = {
    "parent": {"page_id": NOTION_PARENT_PAGE_ID},
    "properties": {
        "title": {
            "title": [{"text": {"content": f"{display_date} {bulletin['title']}"}}]
        }
    },
    "children": [
        heading1("1. 만남과 인사"),
        divider(),

        heading1("2. 시작기도"),
        paragraph(content["open_prayer"]),
        divider(),

        heading1(f"3. 찬양  {bulletin.get('hymn_open', '')}"),
        divider(),

        heading1("4. 성경공부"),
        heading2(bulletin["title"]),
        paragraph(bulletin["scripture_ref"], bold=True),
        paragraph(""),
        paragraph(bulletin["scripture_text"]),
        paragraph(""),
        callout(content["commentary"]),
        paragraph(""),
        paragraph("토의사항", bold=True),
        paragraph(""),
        *qa_blocks,
        divider(),

        heading1("5. 정리"),
        paragraph(content["summary"]),
        divider(),

        heading1(f"6. 찬송  {bulletin.get('hymn_close', '')}"),
        divider(),

        heading1("7. 기도"),
        paragraph(content["close_prayer"]),
        divider(),

        heading1("8. 다음 시간 약속"),
        paragraph(""),
        divider(),

        heading1("9. 주기도문"),
    ]
}

res = requests.post(
    "https://api.notion.com/v1/pages",
    headers=headers,
    json=page_body
)

if res.status_code == 200:
    page_url = res.json().get("url", "")
    print(f"노션 페이지 생성 완료: {page_url}")
else:
    raise Exception(f"노션 페이지 생성 실패: {res.text}")
```

---

## 완료

생성된 노션 페이지 URL을 출력하고 사용자에게 알려준다.
```

---

## 환경 변수 설정 방법 (맥북 기준)

터미널에서 아래 명령으로 설정:

```bash
export OPENAI_API_KEY="sk-..."
export NOTION_TOKEN="secret_..."
export NOTION_PARENT_PAGE_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

영구 설정은 `~/.zshrc`에 추가.

---

## 파일 구조 참고

벧엘교회 주보 PDF URL 패턴:
`http://bethel.or.kr/wp-content/uploads/YYYY/MM/weeklyYYMMDD.pdf`

예: `http://bethel.or.kr/wp-content/uploads/2026/06/weekly260601.pdf`
