# 목표 아키텍처: Vercel + Supabase + GitHub Actions + EC2 Dev

## 1. 문서 목적

이 문서는 `bethel803`의 다음 운영 기준 아키텍처를 정의한다.

목표는 단순히 “어디에 배포할 것인가”를 정하는 것이 아니라, 아래를 분명히 하는 것이다.

- 어떤 플랫폼이 어떤 책임을 가지는가
- preview, staging, production을 어떻게 분리할 것인가
- EC2를 어디까지 개발 인프라로 쓰고 어디부터 운영에서 제외할 것인가
- `gstack` 원칙을 Codex 중심 운영 규칙으로 어떻게 아키텍처에 반영할 것인가

## 2. 결정 요약

`bethel803`의 목표 운영 구조는 아래와 같이 잡는다.

- 형상관리와 협업: GitHub
- 프론트 배포와 preview/prod 서빙: Vercel
- 앱 백엔드와 권한/저장소: Supabase
- 정기 작업과 무거운 배치: GitHub Actions
- 원격 개발 환경: EC2

한 줄로 정리하면:

`EC2는 개발 머신이고, 운영 서비스의 기준선은 Vercel + Supabase + GitHub Actions다.`

## 3. 아키텍처 결정 원칙

이 문서는 [Codex_gstack_도입안.md](/home/ubuntu/bethel803/docs/Codex_gstack_도입안.md)의 원칙을 아키텍처 결정 기준으로 사용한다.

### 3.1 Search Before Building

- 기존에 검증된 운영 패턴을 우선 사용한다.
- `csv-report-bot`에서 확인된 `Vercel + Supabase + GitHub Actions` 구조를 참고 기준선으로 삼는다.
- 단, `bethel803`는 인증/RLS/구역 데이터/알림이 중심이므로 그대로 복제하지 않고 앱 구조에 맞게 재설계한다.

### 3.2 Role-Separated Thinking

아키텍처 판단은 아래 관점으로 나눠 본다.

- Product/Ops: 실제 운영자가 이해하기 쉬운가
- Architecture: 책임 경계가 명확한가
- QA: preview와 production의 차이를 설명 가능하게 관리하는가
- Security: 권한과 secret 경계가 분리되어 있는가
- Docs/Release: 운영 문서로 계속 유지 가능한가

### 3.3 Docs as Runtime Assets

- 환경 구조 변경은 문서 변경 없이 끝난 것으로 보지 않는다.
- staging/prod/env 규칙은 문서로 고정하고, 반영 시 체크리스트로 다시 검증한다.

### 3.4 guard-ops 원칙

- 운영 DB와 운영 배포를 건드리는 작업은 “작게 나누어 반영”한다.
- `preview 배포`와 `운영 백엔드 반영`은 같은 단계로 취급하지 않는다.

## 4. 왜 이 구조가 필요한가

현재 `bethel803`는 단순 정적 웹사이트가 아니라 아래 성격을 가진 앱이다.

- 로그인과 역할 기반 접근
- 구역별 데이터 분리
- Supabase RLS 의존
- Edge Function 기반 자동화
- 향후 웹푸시와 AI 기능 확장

이 성격 때문에 아래는 충분하지 않다.

- GitHub 브랜치만으로 운영/테스트를 구분하는 것
- Vercel preview만으로 백엔드 검증을 대신하는 것
- EC2에 운영 cron과 운영 백엔드를 계속 올려두는 것

즉, 코드 preview와 데이터 환경 분리를 따로 설계해야 한다.

## 5. 목표 시스템 구조

```text
[Developer]
  -> SSH / VS Code / Codex
  -> EC2 Dev Workspace
        |
        +-> GitHub Repository
              - main
              - feat/*
              - PR / review / Actions
        |
        +-> Vercel
              - Preview Deployments
              - Production Deployment
        |
        +-> Supabase Staging
              - Auth
              - Postgres
              - Storage
              - Edge Functions
        |
        +-> Supabase Production
              - Auth
              - Postgres
              - Storage
              - Edge Functions
        |
        +-> GitHub Actions
              - cron
              - verification
              - long-running jobs
```

## 6. 책임 분리

## 6.1 GitHub

책임:

- 형상관리
- 브랜치 전략
- PR 기반 리뷰
- Actions 기반 cron/배치
- 운영 점검 자동화

하지 않을 것:

- 앱의 실시간 사용자 요청 처리
- 운영 데이터 저장

## 6.2 Vercel

책임:

- React 프론트 배포
- Preview URL 제공
- Production URL 제공
- 필요 시 짧은 실행시간의 얇은 API

장점:

- 브랜치별 preview 확인이 쉬움
- 배포 URL 관리가 단순함
- 프론트 작업 확인 속도가 빠름

주의:

- Vercel preview가 백엔드 데이터까지 자동 분리해주지는 않는다.
- preview가 prod Supabase를 보면 preview도 운영 데이터를 만진다.

## 6.3 Supabase

책임:

- Auth
- PostgreSQL
- RLS
- Storage
- Edge Functions
- 앱 백엔드의 단일 진실 공급원

`bethel803`에서 Supabase가 맡아야 하는 것:

- 사용자/구역/권한 데이터
- 성경공부/기도제목/성경읽기/일정/출석
- 앱 내 알림
- 웹푸시 구독 정보와 발송 로그
- AI 초안 저장

## 6.4 GitHub Actions

책임:

- 정기 실행 cron
- 장시간 작업
- 운영 점검 자동화
- dry-run 검증
- 필요한 경우 배포 후속 처리

`bethel803`에서 GitHub Actions가 적합한 작업:

- 주간 성경읽기 알림 집계
- 운영 상태 점검
- 장시간 AI 처리 보조
- 주기적 정리/리포트 작업

반대로 사용자 클릭에 즉시 반응해야 하는 앱 요청은 GitHub Actions에 두지 않는다.

## 6.5 EC2

책임:

- 원격 개발 서버
- 로컬 대체 작업 환경
- 가벼운 테스트 스크립트 실행
- Codex / Claude / 편집기 접속 기반

허용되는 사용:

- 코딩
- 변경 범위 확인
- 가벼운 정적 검사와 테스트
- 수동 관리 작업
- 마이그레이션 초안 작성

운영 기준선에서 제외해야 하는 것:

- 운영 서비스의 상시 API 서버
- 운영 cron의 유일한 실행 위치
- 운영 배포의 유일한 진입점
- 프론트 빌드의 기준 실행 위치

즉, EC2는 중요하지만 운영 의존점이 되면 안 된다. EC2의 하드웨어 여유가 부족하므로 프론트 빌드는 GitHub에 커밋하고 Vercel 배포 과정에서 수행하는 것을 원칙으로 한다.

## 7. 환경 분리 원칙

## 7.1 기본 환경

최소 아래 3단계 환경을 가정한다.

- `dev`
- `staging`
- `prod`

## 7.2 각 환경의 의미

### dev

- EC2 작업 환경
- 로컬 실행 또는 임시 테스트
- 기능 개발과 초안 검증

### staging

- 운영과 최대한 비슷한 Supabase 환경
- RLS, Edge Function, Storage, 알림, AI 저장 흐름 검증
- 실제 반영 직전 검증용

### prod

- 실제 사용자 운영 환경

## 7.3 핵심 원칙

- preview URL은 코드 확인용이다.
- staging은 데이터/권한/배포 검증용이다.
- prod는 실제 서비스 기준선이다.

즉:

`preview != staging != production`

## 8. 권장 배포 흐름

## 8.1 기본 흐름

1. `main`에서 `feat/*` 브랜치 생성
2. EC2에서 개발
3. EC2에서는 변경 범위 확인과 가벼운 검사만 수행
4. GitHub commit / push
5. Vercel preview 빌드와 배포 로그 확인
6. staging Supabase 기준 검증
7. PR review
8. `main` 반영
9. Vercel production 빌드와 배포 확인
10. 운영 점검

## 8.2 데이터 변경이 있는 경우

다음이 포함되면 반드시 staging을 거친다.

- Supabase migration
- RLS 변경
- Edge Function 변경
- Storage 정책 변경
- 알림/푸시/cron
- AI 발행/저장 구조

## 9. `bethel803`에 맞춘 서비스 경계

## 9.1 브라우저 요청 경로

사용자 브라우저는 기본적으로 다음에만 직접 붙는다.

- Vercel 프론트
- Supabase Auth / DB / Storage / Edge Functions

원칙:

- 프론트는 가능하면 Vercel에만 배포한다.
- 앱의 정식 데이터 처리는 Supabase를 통해서만 간다.

## 9.2 배치 및 자동화 경로

정기 작업은 아래처럼 분리한다.

```text
GitHub Actions cron
 -> Supabase Edge Function 호출 또는 service role DB 접근
 -> 결과 저장
 -> 필요 시 알림/로그 기록
```

이 방식이 좋은 이유:

- EC2 상시 실행을 없앨 수 있다.
- cron 이력과 실패를 GitHub에서 추적 가능하다.
- 재실행 경로가 명확하다.

## 9.3 웹푸시 경로

권장 구조:

```text
사용자 설치/구독
 -> push_subscriptions 저장
 -> 앱 이벤트 또는 cron 발생
 -> notifications 기록
 -> dispatch dry-run / dispatch
 -> push_deliveries 기록
```

실제 푸시 발송은 staging 검증 전까지 연결하지 않는다.

## 10. `csv-report-bot`에서 참고할 점과 다르게 가져갈 점

## 10.1 그대로 참고할 점

- Vercel은 프론트와 preview/prod를 담당
- GitHub Actions는 cron과 장시간 작업을 담당
- Supabase는 저장소와 상태 추적의 중심
- 운영 판단은 production URL 기준
- preview는 새 코드 확인용

## 10.2 다르게 가져갈 점

`bethel803`는 `csv-report-bot`보다 앱 백엔드 성격이 강하다.

그래서 더 중요해지는 것:

- Supabase staging/prod 분리
- RLS 검증
- 역할별 QA
- 알림 정책 검증
- Auth와 Storage 검증

즉, `csv-report-bot`보다 staging의 필요성이 더 크다.

## 11. 운영 원칙

### 11.1 main 원칙

- `main`은 항상 운영 기준선
- preview는 실험과 검증
- 운영 판단은 prod 기준

### 11.2 반영 원칙

- 큰 변경은 한 번에 반영하지 않는다.
- 아래 순서를 지킨다.

1. 문서/초안
2. staging 적용
3. dry-run 검증
4. 운영 반영

### 11.3 문서 원칙

- 아키텍처 변경 시 본 문서를 갱신한다.
- 운영 절차 변경 시 Codex workflow 문서를 함께 갱신한다.
- 반영 전에는 [ops-readiness-bethel803.md](/home/ubuntu/bethel803/docs/codex-workflows/ops-readiness-bethel803.md)를 기준으로 점검한다.

## 12. 지금 기준 추천 다음 단계

아키텍처 결정 후 실제로 해야 할 다음 단계는 아래 순서다.

1. `staging / prod` 환경 분리 표 작성
2. Vercel env 분리 규칙 정리
3. Supabase staging 확보
4. `015` 이후 작업을 staging 기준으로 검증
5. 웹푸시 실발송은 그 다음 단계에서 연결

## 13. 최종 판단

현재 제안하신 방향은 타당하다.

다만 정확한 표현은 아래와 같다.

- `EC2를 운영서버로 쓰지 않고 개발서버로 쓰는 것`은 좋다.
- `Vercel + Supabase + GitHub Actions`를 운영 기준선으로 두는 것도 좋다.
- 하지만 `preview만으로 운영 검증을 대신하는 것`은 부족하다.
- `bethel803`는 반드시 staging 개념을 함께 가져가야 한다.

따라서 `bethel803`의 목표 아키텍처는 아래 한 줄로 고정한다.

`EC2 Dev + GitHub Flow + Vercel Preview/Prod + Supabase Staging/Prod + GitHub Actions Cron`
