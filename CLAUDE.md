# CLAUDE.md — bethel803

> 이 파일은 **변하지 않는 것**을 담는다. 아키텍처, 제약조건, 규칙, 환경 설정.
> "지금 어디까지 했나"는 여기 쓰지 말 것 → `STATE.md`에 쓴다.
> 집(맥북)·회사(윈도우) 어디서 열든, Claude Code·Antigravity 무엇으로 열든,
> 이 파일이 동일한 전제를 보장한다. 어느 도구든 시작 시 이 파일을 읽는다.

---

## 0. 이 프로젝트가 무엇인가

bethel803은 교회 소그룹(구역) 운영을 위한 멀티테넌트 SaaS PWA다.
핵심 가치는 "사용자 규모"가 아니라 **사용 깊이(depth-of-use)**이며,
go-to-market은 **구역장을 겨냥한 B2B2C**다.
기능 추가보다 **동기 엔진(motivation engine)과 운영자 대시보드**가 전략 우선순위다.

---

## 1. 절대 규칙 (세션 시작·종료)

- **세션 시작**: `git pull --rebase` 먼저. 안 하면 집/회사 소스가 갈린다.
- **세션 종료**: `STATE.md` 갱신 → commit → push.
- 코드의 단일 진실 = **GitHub** (`git@github.com:inje21c/bethel803.git`).
- 맥락의 단일 진실 = **이 파일 + STATE.md**.
- EC2 없음. 텔레그램 봇 없음. 개발은 로컬에서만.

---

## 2. 로컬 개발 환경 (실전 메모 — 2026-06-24 검증 완료)

### Git 접속
- **회사 윈도우: HTTPS clone 막힘** (회사 SSL 검사 → `SEC_E_UNTRUSTED_ROOT`).
  → **반드시 SSH로** clone/push:
  `git clone git@github.com:inje21c/bethel803.git`
- 집 맥북: (확인 예정 — SSH 키 등록돼 있으면 동일)

### 폴더 분리 (같은 레포, 두 목적)
| 폴더 | 브랜치 | 목적 | 도구 |
|---|---|---|---|
| `C:\dev\bethel803-web` | main | 웹 운영 개발 | Claude Code / VS Code |
| `C:\Users\NH\bethel803` | feat/capacitor | Android 앱 빌드 | Android Studio + Capacitor |
- 두 폴더는 같은 GitHub 레포를 가리킴. 목적이 다르므로 분리 유지.

### 실행
```
git pull --rebase
npm install
npm run dev      # 로컬: http://localhost:8080
```

---

## 3. 환경변수 (.env.local)

### 프론트엔드 필수 키 5개 (VITE_ 접두사만 프론트에 노출됨)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=http://localhost:8080
VITE_VAPID_PUBLIC_KEY=
VITE_APP_VERSION=local-dev
```

### 출처와 원칙
- **값의 진실 출처 = Vercel → Settings → Environment Variables.**
- preview 환경엔 `VITE_APP_URL` 없음 (preview URL이 동적이라). **로컬은 localhost로 직접 입력.**
- **URL과 ANON_KEY는 반드시 같은 프로젝트의 짝.** preview/prod 값 섞으면 400/401.
- **prod/preview Supabase는 계정이 분리됨.** 로컬 개발은 preview 권장(운영 보호),
  prod는 의식적 예외 시만 + 읽기 위주.
- `VITE_APP_URL`은 Supabase Auth redirect 설정과 일치해야 함(OAuth/매직링크 시).
  단 이메일+비번 로그인(grant_type=password)은 redirect와 무관.
- **GitHub repo secrets는 CI/CD용** (FIREBASE_*, *_DB_URL, SUPABASE_ACCESS_TOKEN_* 등).
  → `.env.local`과 무관. 프론트에 넣지 말 것.
- service_role / OpenAI 키는 프론트 env에 **절대** 넣지 않음 (Edge Function 전용).

---

## 4. 기술 스택

- **프론트**: React + TypeScript + Vite, PWA
- **백엔드/DB**: Supabase (Postgres + RLS, 멀티테넌트). prod / preview(staging) 분리.
- **배포**: Vercel (main → Production, feat/* → Preview 자동 분리)
- **스케줄/서버리스**: Supabase Edge Functions (QT 파이프라인 등, OpenAI 연동)
- **결제**: Toss Payments (상태는 STATE.md 확인)
- **알림**: Web Push (VAPID), KakaoTalk 공지 생성
- **manifest**: `public/manifest.webmanifest`는 **Vite(PWA)가 빌드 시 생성** → git 추적 안 함.

---

## 5. 브랜치 규칙

- 운영 라인 = **main** (Vercel Production).
- feat/* = 기능/실험 (Vercel Preview). 완료 시 main 병합 후 삭제 지향.
- **공통 문서(docs/)·맥락 파일(CLAUDE.md/STATE.md)은 항상 main에서만** 추가·수정.
  feature 브랜치엔 넣지 않는다. (안 그러면 자산이 브랜치에 갇힘)
- 모든 기기는 main을 기준선으로 pull/push.
- ⚠️ 현재 살아있는 feature 브랜치가 19개 — 별도 세션에서 정리 필요(STATE.md 참고).

---

## 6. 전략 우선순위 (기능보다 먼저 묻는다)

1. **동기 엔진** — 왜 구역원이 매일 들어오는가? depth-of-use를 만드는 장치.
2. **운영자(구역장) 대시보드** — 신규 기능보다 우선.
3. donation 모델은 기본 수익 모델로 의존 금지(구조적으로 self-defeating).

> 새 기능 제안 전에: "이게 사용 깊이를 늘리나, 규모만 늘리나?"를 먼저 통과시킬 것.

---

## 7. AI 도구 역할

- **Claude Code** — 주력. 코드 작성·수정·실행 딜리버리.
- **Antigravity (Gemini)** — Claude 리미트 시 폴백. 코드 시각화/구조 파악.
- 한 작업에 **한 도구**. 동시 중복 금지.
- 어느 도구든 이 CLAUDE.md를 읽고 시작 → 진실 분기 금지.

---

## 8. 작업 방식

- 단계마다 진행 보고 후 확인 대기. 임의 진행 금지.
- 표면 해결책보다 **문제 구조 해부** 우선.
- 소스 정리 5단계: ①구조 분석 ②미사용 코드 제거 ③컴포넌트 재구성 ④web_content 대조 ⑤빌드 체크.
