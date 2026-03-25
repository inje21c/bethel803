# bethel803

벧엘교회 킨텍스장성남 구역 관리 시스템.

현재 저장소 기준으로 이 프로젝트는 React SPA 프론트엔드와 Supabase 백엔드를 사용하는 운영형 구조다. 주요 기능은 성경공부, 기도제목, 성경읽기, 일정/출석, 관리자 운영, 주간 보고, 알림, 자동화 기능이다.

## 기술 스택

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn-ui
- TanStack Query
- Supabase Auth / PostgreSQL / Storage / Edge Functions
- Firebase Hosting

## 주요 기능

- 이메일/비밀번호 로그인, 회원가입, 승인 대기, 비밀번호 재설정
- 구역 단위 성경공부 조회 및 답변 저장
- 기도제목 등록, 응답, 중보기도 공유/참여
- 성경읽기 기록 및 관리자 통계
- 일정 관리, 출석 응답, 첨부 업로드
- 관리자 대시보드, 주간 보고, CSV 내보내기
- 앱 내 알림, 전역 검색
- 오늘의 묵상 수집, 주보 PDF 파싱, 주간 마감 자동화 코드

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`를 참고해 `.env.local`을 만든다.

필수 프론트 환경 변수:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_APP_URL=http://localhost:8080
```

주의:

- `service_role` 키는 프론트 `.env`에 넣지 않는다.
- `OPENAI_API_KEY`는 Supabase Edge Function 환경 변수로만 설정한다.

### 3. 개발 서버 실행

```bash
npm run dev
```

기본 주소:

- `http://localhost:8080`

## 검증 명령

```bash
npm test
npm run build
```

## 배포

프론트는 현재 `firebase.json` 기준 정적 배포 구성을 포함한다.

배포 전 확인:

1. `npm run build`
2. `dist/` 생성 확인
3. 운영 URL에 맞춰 `VITE_APP_URL`과 Supabase Auth Redirect URL 정렬

## Supabase 운영 메모

프론트 외에 아래 운영 항목이 필요하다.

- 마이그레이션 적용
- `attachments` Storage 버킷 생성
- Edge Function 배포
- Edge Function 환경 변수 설정
- `pg_cron` 등록 확인

자동화 관련 함수:

- `fetch-devotional`
- `parse-bulletin`
- `compute_weekly_report()`

## 문서

- 서비스 개요: [01_서비스개요_현재구현.md](/home/ubuntu/bethel803/docs/기능설계/01_서비스개요_현재구현.md)
- 핵심 기능: [02_핵심업무기능.md](/home/ubuntu/bethel803/docs/기능설계/02_핵심업무기능.md)
- 데이터/아키텍처: [04_데이터_아키텍처.md](/home/ubuntu/bethel803/docs/기능설계/04_데이터_아키텍처.md)
- 개발 로드맵: [05_개발로드맵.md](/home/ubuntu/bethel803/docs/기능설계/05_개발로드맵.md)
- 운영 체크리스트: [운영준비체크리스트.md](/home/ubuntu/bethel803/docs/운영준비체크리스트.md)
- 운영 가이드: [OPERATIONS.md](/home/ubuntu/bethel803/docs/OPERATIONS.md)

## 현재 상태

현재 코드 기준으로 핵심 기능은 대부분 구현되어 있다. 남은 핵심 작업은 신규 기능 개발보다 운영 환경 활성화, 역할별 실사용 검증, 성능 정리, PWA 적용 여부 결정이다.
