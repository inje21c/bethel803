# env 값 입력표

## 1. 문서 목적

이 문서는 `bethel803`의 환경 변수를 실제로 입력할 때 사용하는 작업표다.

주의:

- 이 문서는 비밀값 자체를 저장소에 적어두기 위한 문서가 아니다.
- 실제 값은 Vercel, Supabase, GitHub Secrets에 입력하고, 여기에는 자리값 또는 확인 상태만 기록한다.

관련 문서:

- [12_staging_prod_환경분리표.md](/home/ubuntu/bethel803/docs/기능설계/12_staging_prod_환경분리표.md)
- [13_staging_준비체크리스트.md](/home/ubuntu/bethel803/docs/기능설계/13_staging_준비체크리스트.md)
- [11_목표아키텍처_Vercel_Supabase_GitHubActions.md](/home/ubuntu/bethel803/docs/기능설계/11_목표아키텍처_Vercel_Supabase_GitHubActions.md)

## 2. 작성 규칙

- 실제 secret 값은 적지 않는다.
- 대신 아래처럼 기록한다.
  - 입력 완료
  - 미입력
  - 확인 필요
  - 해당 없음
- URL, 프로젝트 이름, 환경 이름처럼 비밀이 아닌 값은 적어도 된다.

## 3. 환경 식별 정보

| 항목 | staging | prod |
|------|------|------|
| Supabase 프로젝트 이름 | [입력] | [입력] |
| Supabase 프로젝트 URL | [입력] | [입력] |
| Vercel 환경 | Preview | Production |
| 앱 URL | [입력] | [입력] |
| GitHub Environment | `staging` | `production` |

## 4. Vercel env 입력표

## 4.1 Preview

대상:

- Vercel Project -> Settings -> Environment Variables
- Environment = `Preview`

| 키 | 넣을 값 | 상태 | 메모 |
|------|------|------|------|
| `VITE_SUPABASE_URL` | staging Supabase URL | [ ] | |
| `VITE_SUPABASE_ANON_KEY` | staging anon key | [ ] | |
| `VITE_APP_URL` | preview URL 정책값 | [ ] | 브랜치 preview 기준 |
| `VITE_VAPID_PUBLIC_KEY` | staging 공개 VAPID 키 | [ ] | 웹푸시 구독용 |
| `VITE_APP_VERSION` | `staging-preview` 등 | [ ] | 선택 |

권장 메모:

- Preview는 staging Supabase를 보게 한다.

## 4.2 Production

대상:

- Vercel Project -> Settings -> Environment Variables
- Environment = `Production`

| 키 | 넣을 값 | 상태 | 메모 |
|------|------|------|------|
| `VITE_SUPABASE_URL` | prod Supabase URL | [ ] | |
| `VITE_SUPABASE_ANON_KEY` | prod anon key | [ ] | |
| `VITE_APP_URL` | 운영 앱 URL | [ ] | Auth redirect와 일치해야 함 |
| `VITE_VAPID_PUBLIC_KEY` | prod 공개 VAPID 키 | [ ] | 웹푸시 구독용 |
| `VITE_APP_VERSION` | `prod-2026-04` 등 | [ ] | 선택 |

## 5. EC2 dev `.env.local` 입력표

대상:

- EC2 작업 디렉토리 `.env.local`

권장 원칙:

- dev는 staging Supabase를 본다.

| 키 | 넣을 값 | 상태 | 메모 |
|------|------|------|------|
| `VITE_SUPABASE_URL` | staging Supabase URL | [ ] | |
| `VITE_SUPABASE_ANON_KEY` | staging anon key | [ ] | |
| `VITE_APP_URL` | `http://localhost:8080` 또는 dev URL | [ ] | |
| `VITE_VAPID_PUBLIC_KEY` | staging 공개 VAPID 키 | [ ] | |
| `VITE_APP_VERSION` | `local-dev` 등 | [ ] | 선택 |

## 6. Supabase Edge Function env 입력표

대상:

- Supabase Project -> Edge Functions -> Secrets 또는 env 설정

## 6.1 staging

| 키 | 넣을 값 | 상태 | 메모 |
|------|------|------|------|
| `SUPABASE_URL` | staging Supabase URL | [ ] | |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service role key | [ ] | |
| `OPENAI_API_KEY` | staging용 또는 공용 OpenAI key | [ ] | |
| `PUSH_DISPATCH_SECRET` | staging 내부 호출 secret | [ ] | |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | staging 비공개 VAPID 키 | [ ] | push 발송용 |
| `WEB_PUSH_VAPID_SUBJECT` | `mailto:` 또는 운영 메일 | [ ] | push 발송용 |

대상 함수:

- `fetch-devotional`
- `parse-bulletin`
- `push-subscriptions`
- `push-dispatch`

## 6.2 prod

| 키 | 넣을 값 | 상태 | 메모 |
|------|------|------|------|
| `SUPABASE_URL` | prod Supabase URL | [ ] | |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service role key | [ ] | |
| `OPENAI_API_KEY` | prod OpenAI key | [ ] | |
| `PUSH_DISPATCH_SECRET` | prod 내부 호출 secret | [ ] | |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | prod 비공개 VAPID 키 | [ ] | push 발송용 |
| `WEB_PUSH_VAPID_SUBJECT` | `mailto:` 또는 운영 메일 | [ ] | push 발송용 |

주의:

- staging과 prod의 service role key를 재사용하지 않는다.
- staging과 prod의 dispatch secret도 다르게 둔다.

## 7. GitHub Actions env / secret 입력표

권장:

- GitHub Environments를 `staging`, `production`으로 분리

## 7.1 GitHub Environment: staging

| 키 | 넣을 값 | 상태 | 메모 |
|------|------|------|------|
| `SUPABASE_URL` | staging Supabase URL | [ ] | |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service role key | [ ] | |
| `OPENAI_API_KEY` | staging OpenAI key | [ ] | |
| `APP_URL` | staging 앱 URL | [ ] | |
| `PUSH_DISPATCH_SECRET` | staging dispatch secret | [ ] | |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | staging 비공개 VAPID 키 | [ ] | |
| `WEB_PUSH_VAPID_SUBJECT` | 운영 메일 또는 관리자 메일 | [ ] | |
| `VERCEL_TOKEN` | 필요 시 | [ ] | 선택 |
| `VERCEL_PROJECT_ID` | 필요 시 | [ ] | 선택 |

## 7.2 GitHub Environment: production

| 키 | 넣을 값 | 상태 | 메모 |
|------|------|------|------|
| `SUPABASE_URL` | prod Supabase URL | [ ] | |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service role key | [ ] | |
| `OPENAI_API_KEY` | prod OpenAI key | [ ] | |
| `APP_URL` | 운영 앱 URL | [ ] | |
| `PUSH_DISPATCH_SECRET` | prod dispatch secret | [ ] | |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | prod 비공개 VAPID 키 | [ ] | |
| `WEB_PUSH_VAPID_SUBJECT` | 운영 메일 또는 관리자 메일 | [ ] | |
| `VERCEL_TOKEN` | 필요 시 | [ ] | 선택 |
| `VERCEL_PROJECT_ID` | 필요 시 | [ ] | 선택 |

## 8. Auth Redirect 정렬표

이 항목은 값 입력보다 정렬 확인이 중요하다.

| 항목 | staging | prod | 상태 |
|------|------|------|------|
| `VITE_APP_URL` | [입력] | [입력] | [ ] |
| Supabase Auth Redirect URL | [입력] | [입력] | [ ] |
| 실제 프론트 도메인 | [입력] | [입력] | [ ] |

원칙:

- 세 값은 환경별로 서로 일치해야 한다.

## 9. Storage / Function 대상 확인표

| 항목 | staging | prod | 상태 | 메모 |
|------|------|------|------|------|
| `attachments` 버킷 생성 | [입력] | [입력] | [ ] | |
| `fetch-devotional` 배포 | [입력] | [입력] | [ ] | |
| `parse-bulletin` 배포 | [입력] | [입력] | [ ] | |
| `push-subscriptions` 배포 | [입력] | [입력] | [ ] | |
| `push-dispatch` 배포 | [입력] | [입력] | [ ] | |

## 10. Phase 8 전용 확인표

| 항목 | staging | prod | 상태 | 메모 |
|------|------|------|------|------|
| `015` migration 적용 | [입력] | [입력] | [ ] | |
| `push_subscriptions` 확인 | [입력] | [입력] | [ ] | |
| `notification_preferences` 확인 | [입력] | [입력] | [ ] | |
| `push_deliveries` 확인 | [입력] | [입력] | [ ] | |
| `push-dispatch` dry-run 성공 | [입력] | [입력] | [ ] | prod는 staging 후 |

## 11. 최종 체크

아래가 모두 체크되면 env 입력 단계는 완료다.

- [ ] Vercel Preview env 입력 완료
- [ ] Vercel Production env 입력 완료
- [ ] EC2 `.env.local` 입력 완료
- [ ] Supabase staging function env 입력 완료
- [ ] Supabase prod function env 입력 완료
- [ ] GitHub staging secrets 입력 완료
- [ ] GitHub production secrets 입력 완료
- [ ] Auth redirect 정렬 확인 완료

## 12. 다음 단계

env 입력이 끝나면 다음 문서로 넘어간다.

1. [13_staging_준비체크리스트.md](/home/ubuntu/bethel803/docs/기능설계/13_staging_준비체크리스트.md) 실행
2. staging dry-run 검증 결과 기록
3. prod 반영 체크리스트 작성
