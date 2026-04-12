# staging / prod 환경 분리 표

## 1. 문서 목적

이 문서는 `bethel803`의 목표 아키텍처를 실제 환경 변수와 배포 대상 기준으로 풀어쓴 실행 문서다.

목표:

- `dev`, `preview`, `staging`, `prod`를 혼동하지 않게 한다.
- Vercel, Supabase, GitHub Actions에서 어떤 값을 어디에 넣는지 고정한다.
- preview가 운영 데이터를 건드리지 않도록 기본 원칙을 정한다.

관련 문서:

- [11_목표아키텍처_Vercel_Supabase_GitHubActions.md](/home/ubuntu/bethel803/docs/기능설계/11_목표아키텍처_Vercel_Supabase_GitHubActions.md)
- [10_Phase8_실반영_컷오프_가이드.md](/home/ubuntu/bethel803/docs/기능설계/10_Phase8_실반영_컷오프_가이드.md)
- [ops-readiness-bethel803.md](/home/ubuntu/bethel803/docs/codex-workflows/ops-readiness-bethel803.md)

## 2. 환경 정의

| 환경 | 의미 | 주 사용 위치 |
|------|------|------|
| `dev` | EC2 원격 개발 환경, 로컬 실행, 초안 검증 | EC2 shell / `npm run dev` |
| `preview` | 브랜치별 프론트 미리보기 | Vercel Preview |
| `staging` | 운영과 유사한 백엔드 검증 환경 | 별도 Supabase 프로젝트 또는 Supabase branch |
| `prod` | 실제 사용자 운영 환경 | Vercel Production + Supabase Production |

핵심 원칙:

- `preview`는 코드 확인용이다.
- `staging`은 데이터/권한/함수 검증용이다.
- `prod`는 운영 판단 기준이다.

## 3. 기본 연결 원칙

## 3.1 가장 안전한 기본값

- `dev` -> Supabase staging
- `preview` -> Supabase staging
- `prod` -> Supabase prod

이유:

- preview에서 실수로 운영 데이터를 건드리는 일을 줄일 수 있다.
- 새 RLS, 새 함수, 새 스키마를 운영 전에 staging에서 확인할 수 있다.

## 3.2 예외

아래처럼 UI만 보는 경우에는 preview에서 더미 값이나 읽기 전용 경로를 써도 된다.

- PWA 설치 버튼
- 아이콘/브랜드
- 레이아웃/문구
- 정적 안내 페이지

하지만 `bethel803`의 핵심 기능은 대부분 로그인/DB/권한과 연결되므로, 기본적으로 preview는 staging Supabase를 보는 쪽이 안전하다.

## 4. 플랫폼별 책임

## 4.1 Vercel

Vercel이 관리하는 것:

- 프론트 빌드
- Preview URL
- Production URL
- 프론트 런타임 env

Vercel이 자동으로 분리해주지 않는 것:

- Supabase DB
- Auth 사용자
- Storage 버킷
- Edge Function 실행 대상

즉, Vercel preview를 써도 연결된 Supabase 값이 prod면 운영 데이터에 붙는다.

## 4.2 Supabase

Supabase가 관리하는 것:

- Auth
- Postgres
- RLS
- Storage
- Edge Functions
- cron 또는 함수 실행 대상

따라서 staging / prod 분리는 Supabase 기준으로도 반드시 설계해야 한다.

## 4.3 GitHub Actions

GitHub Actions가 관리하는 것:

- 스케줄 작업
- 장시간 작업
- 운영 점검
- dry-run 검증

환경별로 secret 세트를 분리해 주는 것이 원칙이다.

## 5. 환경 변수 매핑 표

## 5.1 프론트 런타임 env

대상:

- Vercel Preview
- Vercel Production
- EC2 개발 `.env.local`

| 키 | dev | preview | prod | 설명 |
|------|------|------|------|------|
| `VITE_SUPABASE_URL` | staging URL 권장 | staging URL 권장 | prod URL | 브라우저용 Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | staging anon key 권장 | staging anon key 권장 | prod anon key | 브라우저용 anon key |
| `VITE_APP_URL` | `http://localhost:8080` 또는 dev URL | preview URL | 운영 URL | Auth redirect 기준 URL |

원칙:

- 프론트에는 `service_role`을 넣지 않는다.
- 프론트에는 `OPENAI_API_KEY`를 넣지 않는다.

## 5.2 Supabase Edge Function env

대상 함수:

- `fetch-devotional`
- `parse-bulletin`
- `push-subscriptions`
- `push-dispatch`
- 이후 AI 함수들

| 키 | staging | prod | 설명 |
|------|------|------|------|
| `SUPABASE_URL` | staging project URL | prod project URL | 함수 내부 Supabase 연결 |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service role | prod service role | 서버 권한 작업 |
| `OPENAI_API_KEY` | staging용 또는 공용 키 | prod용 키 | OpenAI 호출 |
| `PUSH_DISPATCH_SECRET` | staging secret | prod secret | 내부 발송 호출 보호 |

주의:

- staging과 prod의 service role key는 절대 같게 두지 않는다.
- preview 프론트가 prod function을 보지 않게 URL/프로젝트 기준을 같이 맞춘다.

## 5.3 GitHub Actions secret

`bethel803`에서 환경별로 분리해야 하는 대표 secret:

| 키 | staging workflow | prod workflow | 설명 |
|------|------|------|------|
| `SUPABASE_URL` | staging | prod | Actions에서 DB/함수 접근 |
| `SUPABASE_SERVICE_ROLE_KEY` | staging | prod | service role |
| `OPENAI_API_KEY` | staging 또는 공용 | prod | AI 호출 |
| `APP_URL` | staging URL | 운영 URL | 알림/링크 생성 |
| `PUSH_DISPATCH_SECRET` | staging | prod | 함수 내부 호출 보호 |
| `VERCEL_PROJECT_ID` | 선택 | 선택 | 필요 시 배포/검증 |
| `VERCEL_TOKEN` | 선택 | 선택 | 필요 시 배포/검증 |

권장:

- GitHub Environments를 `staging`, `production`으로 분리
- 각 환경에 secret을 따로 둔다

## 6. URL 매핑 표

| 구분 | staging | prod |
|------|------|------|
| 프론트 앱 URL | 예: `https://bethel803-staging.vercel.app` | 예: `https://bethel803.example.com` |
| Supabase URL | staging project URL | prod project URL |
| Auth Redirect URL | staging 앱 URL 기준 | 운영 앱 URL 기준 |
| Storage 공개 URL | staging 버킷 기준 | prod 버킷 기준 |
| Edge Function 호출 대상 | staging project | prod project |

원칙:

- `VITE_APP_URL`
- Supabase Auth Redirect URL
- 실제 프론트 도메인

이 3개는 항상 같은 환경끼리 정렬되어야 한다.

## 7. 환경별 사용 규칙

## 7.1 dev

권장:

- EC2에서 `npm run dev`
- staging Supabase에 연결
- 테스트 계정 사용

하지 말 것:

- prod service role 사용
- 운영 사용자 계정으로 반복 테스트

## 7.2 preview

권장:

- 브랜치 UI 확인
- staging Supabase 사용
- 기능 흐름 확인

하지 말 것:

- 운영 데이터 기준의 판단
- 운영 장애 여부 결정

## 7.3 staging

권장:

- migration 적용
- RLS 확인
- Edge Function 배포
- Storage 버킷 확인
- push dry-run
- AI draft 저장 검증

staging에서 반드시 확인할 것:

- 로그인
- 권한
- 구역 분리
- 알림 정책
- 주간 집계
- 함수 env

## 7.4 prod

권장:

- 운영 반영 후 최종 검증
- 실제 사용자 영향 확인
- 운영 URL 기준 판단

## 8. `bethel803` 현재 작업에 대한 적용 기준

현재 Phase 8에서 아래는 staging이 반드시 필요하다.

- `015` migration
- `push_subscriptions`
- `notification_preferences`
- `push_deliveries`
- `push-subscriptions` 함수
- `push-dispatch` 함수
- 주간 성경읽기 dry-run
- AI draft 저장

반면 아래는 preview만으로도 어느 정도 볼 수 있다.

- PWA 설치 UX
- 설치 버튼 노출
- 아이콘/브랜드 반영
- 안내 문구

## 9. 권장 초기 구성안

처음부터 과하게 복잡하게 만들지 않고 아래 구성을 권장한다.

### 9.1 Vercel

- Project 1개
- Environment:
  - Preview
  - Production

기본 매핑:

- Preview env -> Supabase staging
- Production env -> Supabase prod

### 9.2 Supabase

둘 중 하나:

1. 별도 staging 프로젝트 + prod 프로젝트
2. Supabase branch 기능 사용

초기 안정성 기준 추천:

- 교회 앱처럼 운영 데이터 보호가 중요하면 별도 프로젝트 방식이 더 이해하기 쉽다.

### 9.3 GitHub Actions

- `staging`용 workflow dispatch 또는 branch 조건
- `production`용 main 기준 workflow
- cron은 prod 기준, 필요 시 staging 수동 실행 가능

## 10. 실무 체크리스트

### 10.1 Vercel

- [ ] Preview env에 staging Supabase 값 입력
- [ ] Production env에 prod Supabase 값 입력
- [ ] preview URL과 `VITE_APP_URL` 정책 정리

### 10.2 Supabase staging

- [ ] staging project 또는 branch 확보
- [ ] Auth redirect URL 설정
- [ ] `attachments` 버킷 생성
- [ ] Edge Function env 입력
- [ ] push 관련 함수 배포

### 10.3 GitHub Actions

- [ ] staging secret 세트 준비
- [ ] prod secret 세트 준비
- [ ] workflow별 환경 분기 규칙 문서화

## 11. 운영 원칙 요약

한 줄 규칙:

- `preview는 코드 검증`
- `staging은 백엔드 검증`
- `prod는 운영 기준`

실무 규칙:

- preview 성공만으로 운영 반영하지 않는다.
- 데이터/권한/함수 변경은 staging을 통과해야 한다.
- 운영 이슈 판단은 항상 prod URL 기준으로 한다.

## 12. 다음 단계

이 문서 다음으로 이어질 실제 작업은 아래 순서가 좋다.

1. Vercel env 표를 실제 값 입력 자리까지 채우기
2. Supabase staging 확보
3. `015` migration을 staging에 적용
4. push 함수 staging 배포
5. dry-run 검증
6. 그 다음 prod 반영
