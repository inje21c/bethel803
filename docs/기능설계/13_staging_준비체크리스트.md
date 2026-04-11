# staging 준비 체크리스트

## 1. 문서 목적

이 문서는 `bethel803`의 `staging` 환경을 실제로 준비할 때 따라야 할 순서를 정리한다.

이 문서의 목적은 다음과 같다.

- Vercel Preview와 별개로 `staging` 백엔드 환경을 확보한다.
- Supabase, Vercel, GitHub Actions 설정 순서를 고정한다.
- `Phase 8` 작업을 운영 반영 전에 검증할 수 있는 최소 기준을 만든다.

관련 문서:

- [11_목표아키텍처_Vercel_Supabase_GitHubActions.md](/home/ubuntu/bethel803/docs/기능설계/11_목표아키텍처_Vercel_Supabase_GitHubActions.md)
- [12_staging_prod_환경분리표.md](/home/ubuntu/bethel803/docs/기능설계/12_staging_prod_환경분리표.md)
- [10_Phase8_실반영_컷오프_가이드.md](/home/ubuntu/bethel803/docs/기능설계/10_Phase8_실반영_컷오프_가이드.md)
- [ops-readiness-bethel803.md](/home/ubuntu/bethel803/docs/codex-workflows/ops-readiness-bethel803.md)

## 2. 완료 기준

이 체크리스트는 아래가 모두 충족되면 완료다.

- staging Supabase가 준비됨
- staging용 Vercel 연결이 정리됨
- staging용 GitHub Actions secret이 준비됨
- Auth redirect / Storage / Edge Function / dry-run 검증이 가능함
- `013` 이후 작업을 staging에서 안전하게 시험할 수 있음

## 3. 준비 원칙

- preview와 staging을 같은 것으로 취급하지 않는다.
- staging에서는 운영과 같은 종류의 기능을 검증하되, 운영 데이터는 쓰지 않는다.
- service role, anon key, redirect URL은 환경별로 분리한다.
- 실제 푸시 발송은 staging에서 dry-run 확인 후 마지막에만 연결한다.

## 4. 작업 순서

## 4.1 staging Supabase 확보

둘 중 하나를 먼저 정한다.

- 별도 staging 프로젝트 생성
- Supabase branch 사용

현재 권장:

- `bethel803`는 Auth, RLS, Storage, 알림이 중요하므로 별도 staging 프로젝트가 이해하기 쉽다.

체크:

- [ ] staging Supabase 프로젝트 또는 branch 생성
- [ ] 프로젝트 이름/식별자 문서화
- [ ] staging 프로젝트 URL 확보
- [ ] staging anon key 확보
- [ ] staging service role key 확보

메모:

- 이 정보는 운영 문서에는 자리만 남기고 실제 값은 비밀 저장소에 둔다.

## 4.2 staging DB 초기화

체크:

- [ ] 기존 운영 기준 마이그레이션 적용
- [ ] 핵심 테이블 존재 확인
- [ ] `districts` 시드 데이터 확인
- [ ] `compute_weekly_report()` 함수 확인
- [ ] `attachments` 버킷 생성

Phase 8 준비 항목:

- [ ] [013_phase8_push_notifications.sql](/home/ubuntu/bethel803/supabase/migrations/013_phase8_push_notifications.sql) 적용
- [ ] `push_subscriptions` 테이블 확인
- [ ] `notification_preferences` 테이블 확인
- [ ] `push_deliveries` 테이블 확인
- [ ] `notifications` 확장 컬럼 확인

## 4.3 staging Auth 설정

체크:

- [ ] staging 앱 URL 결정
- [ ] Supabase Auth Redirect URL에 staging 앱 URL 등록
- [ ] 비밀번호 재설정 redirect 동작 확인
- [ ] 테스트 계정 생성 규칙 정리

권장 테스트 계정:

- [ ] `master` 1명
- [ ] `leader` 1명
- [ ] `member` 2명 이상
- [ ] 서로 다른 구역 소속 계정

## 4.4 staging Storage 준비

체크:

- [ ] `attachments` 버킷 생성
- [ ] 공개 정책 또는 접근 정책 확인
- [ ] 테스트 업로드 1회 성공
- [ ] 공개 URL 열람 확인

후속 Phase 8 대비:

- [ ] 푸시 관련 추가 버킷이 필요한지 검토
- [ ] AI draft 첨부 저장이 필요한지 검토

## 4.5 staging Edge Function env 입력

대상 함수:

- `fetch-devotional`
- `parse-bulletin`
- `push-subscriptions`
- `push-dispatch`
- 이후 AI 함수

체크:

- [ ] `SUPABASE_URL` 입력
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 입력
- [ ] `OPENAI_API_KEY` 입력
- [ ] `PUSH_DISPATCH_SECRET` 입력

주의:

- staging과 prod secret을 재사용하지 않는다.

## 4.6 staging Edge Function 배포

체크:

- [ ] `fetch-devotional` 배포
- [ ] `parse-bulletin` 배포
- [ ] `push-subscriptions` 배포
- [ ] `push-dispatch` 배포

검증:

- [ ] 함수 목록에서 확인
- [ ] 최근 배포 로그 확인
- [ ] 최소 1회 호출 성공 확인

## 4.7 Vercel Preview / staging 연결

원칙:

- Preview 프론트는 staging Supabase를 보게 한다.

체크:

- [ ] Vercel Preview env에 staging `VITE_SUPABASE_URL` 입력
- [ ] Vercel Preview env에 staging `VITE_SUPABASE_ANON_KEY` 입력
- [ ] Vercel Preview env에 preview용 `VITE_APP_URL` 정책 확정
- [ ] 브랜치 preview에서 로그인 페이지 열림 확인

선택:

- [ ] 별도 staging 프론트 URL을 둘지 결정

권장:

- 초기에는 Vercel Preview를 staging 프론트 확인용으로 사용하고,
- 운영 직전 필요하면 별도 staging 도메인을 추가한다.

## 4.8 GitHub Actions staging secret 준비

체크:

- [ ] GitHub Environment `staging` 생성
- [ ] `SUPABASE_URL` 입력
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 입력
- [ ] `OPENAI_API_KEY` 입력
- [ ] `APP_URL` 입력
- [ ] `PUSH_DISPATCH_SECRET` 입력

필요 시:

- [ ] `VERCEL_TOKEN`
- [ ] `VERCEL_PROJECT_ID`

## 4.9 staging 검증 1차

기본 검증:

- [ ] 로그인
- [ ] 구역 선택/구역 분리
- [ ] 성경공부 조회
- [ ] 기도제목 조회
- [ ] 일정 조회
- [ ] 첨부 업로드

권한 검증:

- [ ] `member` 권한 확인
- [ ] `leader` 권한 확인
- [ ] `master` 권한 확인

## 4.10 Phase 8 검증

`013` 이후 기준:

- [ ] 앱 내 알림 조회가 기존처럼 동작
- [ ] 서비스 공지 조회 정책 확인
- [ ] `push-subscriptions` 저장 호출 성공
- [ ] `push-dispatch` 일반 알림 dry-run 성공
- [ ] `push-dispatch` 주간 성경읽기 dry-run 성공
- [ ] 실제 발송 없이 candidate/enabled/skipped 결과 확인

## 4.11 아직 하지 말아야 할 것

staging 준비 단계에서는 아래를 보류한다.

- [ ] 실제 웹푸시 실발송
- [ ] 운영 사용자 대상 테스트
- [ ] prod DB 마이그레이션 적용
- [ ] prod 함수 env 변경

## 5. 산출물

staging 준비가 끝나면 아래를 남긴다.

- staging Supabase 식별 정보
- staging 앱 URL
- staging 테스트 계정 목록
- 적용한 마이그레이션 목록
- 배포한 함수 목록
- dry-run 검증 결과

## 6. 컷오프 판단

아래까지 되면 staging 준비 단계는 끝이다.

1. staging Supabase 준비 완료
2. Preview -> staging 연결 완료
3. `013` 적용 완료
4. push 함수 배포 완료
5. dry-run 검증 완료

이 시점부터는 다음 단계로 넘어간다.

- 실제 웹푸시 발송 연결
- 운영 반영 전 최종 점검

## 7. 다음 단계

이 문서 다음에 바로 이어질 작업은 아래 순서가 좋다.

1. `staging 값 입력용 env 표`
2. `staging dry-run 검증 보고서`
3. `prod 반영 체크리스트`
