# Operations Guide / 운영 가이드

> Public document / 공개 문서
> Last reviewed / 마지막 점검: 2026-07-07

## English Summary

This guide explains how bethel803 is run, verified, and operated at a high level. It intentionally avoids private credentials and environment-specific secrets. Public readers can use it to understand the operational model, while maintainers should still rely on private deployment settings for actual production work.

## 한국어 요약

이 문서는 bethel803의 실행, 검증, 운영 흐름을 공개 가능한 수준에서 정리합니다. 비공개 자격 증명이나 환경별 시크릿은 포함하지 않습니다. 공개 독자는 운영 모델을 이해하는 데 사용할 수 있고, 실제 운영자는 별도의 비공개 배포 설정을 기준으로 작업해야 합니다.

## 1. Scope / 문서 범위

This guide covers:

- Local development / 로컬 개발 실행
- Frontend deployment model / 프론트 배포 방식
- Supabase configuration areas / Supabase 설정 영역
- Automation checks / 자동화 점검
- Role-based operational smoke tests / 역할별 운영 스모크 테스트

This guide does not include:

- Production secrets / 운영 시크릿
- Private database URLs / 비공개 DB URL
- Real user data / 실제 사용자 데이터
- Manual one-off support credentials / 일회성 지원 자격 증명

## 2. Local Development / 로컬 개발

Required tools / 필요 도구:

- Node.js
- npm

Install and run / 설치와 실행:

```bash
npm install
npm run dev
```

Default local URL / 기본 로컬 주소:

```text
http://localhost:8080
```

## 3. Environment Variables / 환경 변수

Create `.env.local` from `.env.example`. Only frontend-safe values should use the `VITE_` prefix.

`.env.example`을 기준으로 `.env.local`을 만듭니다. 프론트에 노출 가능한 값만 `VITE_` 접두사를 사용합니다.

| Key | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL used by the frontend |
| `VITE_SUPABASE_ANON_KEY` | Public anon key used by the frontend |
| `VITE_APP_URL` | App URL used for auth redirects |
| `VITE_VAPID_PUBLIC_KEY` | Public key for web push when enabled |
| `VITE_APP_VERSION` | App version label |

Security rules / 보안 원칙:

- Do not place `service_role` keys in frontend env files.
  `service_role` 키를 프론트 환경 파일에 넣지 않습니다.
- Do not place `OPENAI_API_KEY` in frontend env files.
  `OPENAI_API_KEY`를 프론트 환경 파일에 넣지 않습니다.
- Edge Function secrets should be managed in Supabase.
  Edge Function 시크릿은 Supabase에서 관리합니다.

## 4. Verification / 검증

Recommended local checks / 권장 로컬 점검:

```bash
npm test
npm run build
```

When local hardware or environment constraints make a full build impractical, the production deployment pipeline should still be checked through Vercel logs.
로컬 환경 제약으로 전체 빌드가 어렵다면, 운영 배포 파이프라인의 Vercel 로그에서 빌드 결과를 반드시 확인합니다.

## 5. Frontend Deployment / 프론트 배포

Primary deployment path / 기본 배포 경로:

1. Commit reviewed changes to GitHub.
   검토된 변경사항을 GitHub에 커밋합니다.
2. Vercel builds the frontend from the repository.
   Vercel이 저장소 기준으로 프론트엔드를 빌드합니다.
3. Check build logs and deployed routes.
   빌드 로그와 배포된 라우트를 확인합니다.
4. Confirm SPA rewrite behavior for direct route access.
   직접 URL 접근 시 SPA rewrite 동작을 확인합니다.

The repository may contain other static hosting configuration files, but Vercel is the main production deployment path.
저장소에 다른 정적 호스팅 설정 파일이 남아 있을 수 있지만, 운영 배포의 기본 경로는 Vercel입니다.

## 6. Supabase Operations / Supabase 운영

### 6.1 Frontend Connection / 프론트 연결

| Value | Purpose |
| --- | --- |
| Supabase URL | Frontend project endpoint / 프론트 프로젝트 엔드포인트 |
| Supabase anon key | Public client key / 공개 클라이언트 키 |
| App URL | Auth redirect and app links / 인증 리디렉션과 앱 링크 |

### 6.2 Edge Function Secrets / Edge Function 시크릿

| Secret | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side privileged access |
| `OPENAI_API_KEY` | AI-assisted automation when configured |

Relevant functions / 관련 함수:

- `fetch-devotional`
- `parse-bulletin`
- `push-dispatch`
- `scheduled-notifications`
- `delete-account`

### 6.3 Database and Storage / DB와 Storage

Before production operation, confirm:

- Migrations are applied.
  마이그레이션이 반영되어 있습니다.
- RLS policies are enabled and reviewed.
  RLS 정책이 활성화되어 있고 검토되었습니다.
- Required Storage buckets exist.
  필요한 Storage 버킷이 존재합니다.
- Automation functions exist and have expected permissions.
  자동화 함수가 존재하고 필요한 권한을 갖습니다.

## 7. Automation / 자동화

| Job | Unit | Purpose |
| --- | --- | --- |
| Devotional fetching / 묵상 수집 | Edge Function | Fetch and store daily devotional content |
| Weekly close / 주간 마감 | DB function or scheduled job | Generate weekly reports and lock states |
| Bulletin parsing / 주보 파싱 | Edge Function | Create Bible study drafts from PDF input |
| Push dispatch / 푸시 발송 | Edge Function | Send web push notifications |

Operational note / 운영 메모:

Supabase cron schedules use UTC. Korean Standard Time schedules should be converted explicitly and verified in the Supabase project.
Supabase cron은 UTC 기준입니다. 한국시간 기준 스케줄은 명시적으로 변환하고 Supabase 프로젝트에서 확인해야 합니다.

## 8. Role-Based Smoke Tests / 역할별 스모크 테스트

Minimum roles / 최소 역할:

- `member`
- `leader`
- `master`
- `superadmin` when platform-level changes are involved

Checkpoints / 점검 항목:

- Members can access normal member workflows only.
  구성원은 일반 기능만 접근할 수 있습니다.
- Leaders can access their own group dashboard and management scope.
  리더는 자기 모임의 관리 범위에 접근할 수 있습니다.
- Masters can access church-level administration when assigned.
  마스터는 지정된 경우 교회 단위 관리에 접근할 수 있습니다.
- Data from another group or church is not visible.
  다른 모임 또는 교회 데이터가 보이지 않습니다.

## 9. Troubleshooting / 문제 해결 기준

### Login succeeds but the app state is wrong / 로그인은 되지만 화면 상태가 이상함

Check:

- User profile exists in `users`.
- `district_id` and `church_id` are valid.
- `status` is `pending` or `active` as expected.
- Role-based route guards match the profile.

### Password reset link does not work / 비밀번호 재설정 링크가 동작하지 않음

Check:

- `VITE_APP_URL`
- Supabase Auth Redirect URL
- Deployed app URL and redirect settings

### Attachment upload fails / 첨부 업로드 실패

Check:

- Storage bucket exists.
- Bucket policy allows the intended operation.
- File size and type are acceptable.

### Automation does not run / 자동화가 실행되지 않음

Check:

- Edge Function deployment
- Function secrets
- Cron registration
- Function logs
- External source availability

## 10. Public Hygiene / 공개 문서 위생

Before committing public documentation:

- Do not include real names, phone numbers, emails, passwords, tokens, or third-party UUIDs unless intentionally public.
  의도적으로 공개하는 정보가 아니라면 실명, 전화번호, 이메일, 비밀번호, 토큰, 제3자 UUID를 포함하지 않습니다.
- Use sample names such as `Member A`, `Leader A`, or `Tester A`.
  `Member A`, `Leader A`, `Tester A` 같은 샘플 이름을 사용합니다.
- Prefer relative repository links over local absolute paths.
  로컬 절대경로보다 저장소 상대 링크를 사용합니다.

## 11. Related Documents / 관련 문서

- [Service Overview / 서비스 개요](./기능설계/01_서비스개요_현재구현.md)
- [Core Features / 핵심 업무 기능](./기능설계/02_핵심업무기능.md)
- [Data Architecture / 데이터 아키텍처](./기능설계/04_데이터_아키텍처.md)
- [Group-First Architecture / 모임 우선 아키텍처](./기능설계/모임우선_아키텍처_재설계.md)
