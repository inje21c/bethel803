# staging 외부설정 실행순서

기준 시각:

- 2026-04-10 UTC

## 1. 목적

이 문서는 `bethel803`의 실제 staging 착수를 위해, Supabase / Vercel / GitHub 콘솔에서 어떤 순서로 작업해야 하는지 실행 관점으로 정리한다.

이 문서는 아래 상황을 전제로 한다.

- 현재 운영 기준선은 Firebase다.
- Vercel은 병행 검증 경로로 먼저 붙인다.
- EC2 개발 `.env.local`은 아직 운영 Supabase 기준일 수 있다.

관련 문서:

- [13_staging_준비체크리스트.md](/home/ubuntu/bethel803/docs/기능설계/13_staging_준비체크리스트.md)
- [14_env_값입력표.md](/home/ubuntu/bethel803/docs/기능설계/14_env_값입력표.md)
- [16_staging_착수현황_2026-04-10.md](/home/ubuntu/bethel803/docs/기능설계/16_staging_착수현황_2026-04-10.md)

## 2. 먼저 할 일

1. Supabase에 staging 프로젝트를 만든다.
2. 아래 세 값을 확보한다.

- staging project URL
- staging anon key
- staging service role key

3. [14_env_값입력표.md](/home/ubuntu/bethel803/docs/기능설계/14_env_값입력표.md) 의 `환경 식별 정보`, `Vercel Preview`, `EC2 dev .env.local`, `Supabase Edge Function env`, `GitHub Environment staging` 칸부터 채운다.

## 3. Supabase staging 설정 순서

### 3.1 프로젝트 생성

- 프로젝트 이름 예시: `bethel803-staging`
- region은 운영과 같게 둔다.
- 운영과 같은 auth/storage 성격을 유지한다.

### 3.2 기본 정보 확보

- Project URL 복사
- anon public key 복사
- service role key 복사

### 3.3 Auth 설정

- Site URL: staging 또는 preview 정책에 맞게 정리
- Redirect URLs:
  - local dev URL
  - preview URL 정책값
  - 필요 시 별도 staging URL

### 3.4 Storage 준비

- `attachments` 버킷 생성

### 3.5 DB 초기화

- 기존 마이그레이션 적용
- [015_phase8_push_subscriptions.sql](/home/ubuntu/bethel803/supabase/migrations/015_phase8_push_subscriptions.sql) 적용
- `push_subscriptions`
- `notification_preferences`
- `push_deliveries`
- `notifications` 확장 컬럼 확인

## 4. EC2 개발 환경 교체 순서

현재 원칙:

- staging이 생기기 전까지 `.env.local`은 바꾸지 않는다.
- staging URL을 확보한 뒤에만 `.env.local`을 교체한다.

실행 순서:

1. 현재 `.env.local` 백업
2. [`.env.staging.example`](/home/ubuntu/bethel803/.env.staging.example) 를 참고해 staging 값으로 교체
3. 아래 명령 실행

```bash
npm run staging:env-check
```

목표:

- EC2 `dev`가 더 이상 운영 Supabase를 보지 않게 만든다.

## 5. Vercel 설정 순서

### 5.1 project 연결

- `bethel803` Vercel project 생성 또는 연결

### 5.2 Preview env 입력

- `VITE_SUPABASE_URL` = staging URL
- `VITE_SUPABASE_ANON_KEY` = staging anon key
- `VITE_APP_URL` = preview 정책값

### 5.3 Production env는 아직 바로 바꾸지 않는다

- 운영이 Firebase에 남아 있는 동안은 Vercel Production을 최종 기준선으로 보지 않는다.
- 먼저 Preview 기반 검증을 끝낸다.

## 6. GitHub 설정 순서

### 6.1 Environment 생성

- `staging`
- `production`

### 6.2 staging secrets / vars 입력

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL`
- 필요 시 이후 GitHub Actions cron용 값

## 7. Supabase Functions 설정 순서

대상 함수:

- `fetch-devotional`
- `parse-bulletin`
- `push-subscriptions`
- `push-dispatch`

staging secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `PUSH_DISPATCH_SECRET`

그다음:

- 함수 배포
- 최소 1회 호출
- `push-dispatch` dry-run

## 8. 여기서 멈추고 검증해야 하는 순간

아래가 끝나면 한 번 멈추고 확인한다.

1. staging Supabase 생성 완료
2. EC2 `.env.local`이 staging으로 전환 완료
3. Vercel Preview env 입력 완료
4. GitHub `staging` environment 입력 완료
5. `015` 적용 완료

이 시점이 첫 번째 실제 검증 컷오프다.

## 9. 바로 실행할 명령

Supabase staging을 만든 뒤에는 아래 순서로 진행한다.

```bash
npm run staging:env-check
npm run staging:preflight
npm run build
```

그다음 Preview 배포와 staging dry-run 검증으로 넘어간다.
