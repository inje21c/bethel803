# bethel803 운영 가이드

## 1. 목적

이 문서는 `bethel803`를 실제로 실행, 배포, 점검할 때 필요한 운영 절차를 정리한다.

이 문서는 다음에 집중한다.

- 로컬 개발 실행
- 프론트 배포 준비
- Supabase 운영 설정
- 자동화 기능 점검

세부 점검 항목은 [운영준비체크리스트.md](/home/ubuntu/bethel803/docs/운영준비체크리스트.md)를 함께 본다.

## 2. 로컬 개발 실행

### 2.1 준비

필수 도구:

- Node.js
- npm

### 2.2 환경 변수

`.env.example`를 기준으로 `.env.local`을 만든다.

필수 값:

| 키 | 설명 |
|----|------|
| `VITE_SUPABASE_URL` | 프론트에서 사용할 Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | 프론트에서 사용할 anon key |
| `VITE_APP_URL` | 비밀번호 재설정 리디렉션용 앱 URL |

주의:

- `service_role` 키는 프론트 `.env`에 넣지 않는다.
- `OPENAI_API_KEY`도 프론트 `.env`에 넣지 않는다.

### 2.3 실행 명령

```bash
npm install
npm run dev
```

기본 개발 서버:

- `http://localhost:8080`

### 2.4 검증 명령

```bash
npm test
npm run build
```

## 3. 프론트 배포

현재 저장소는 `firebase.json` 기준 정적 배포 구성을 포함한다.

### 3.1 배포 전 확인

1. `npm run build`가 성공해야 한다.
2. `dist/`가 생성되어야 한다.
3. SPA rewrite가 필요한 경로가 정상 동작해야 한다.

### 3.2 Firebase Hosting 기준

현재 설정:

- 정적 루트: `dist`
- 모든 경로를 `index.html`로 rewrite
- asset 캐시 헤더 포함

운영 URL이 확정되면 아래도 같이 맞춰야 한다.

- `VITE_APP_URL`
- Supabase Auth Redirect URL

## 4. Supabase 운영 설정

## 4.1 프론트 연결용 값

프론트 런타임에 다음 값이 필요하다.

| 키 | 설명 |
|----|------|
| `VITE_SUPABASE_URL` | 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | public anon key |
| `VITE_APP_URL` | 운영 앱 주소 |

## 4.2 Edge Function 환경 변수

Supabase Functions 환경에는 다음 값이 필요하다.

| 키 | 설명 |
|----|------|
| `SUPABASE_URL` | 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |
| `OPENAI_API_KEY` | OpenAI API key |

대상 함수:

- `fetch-devotional`
- `parse-bulletin`

## 4.3 DB 및 스토리지 확인

운영 전에 아래를 확인한다.

- 마이그레이션이 모두 반영되었는가
- `districts`, `notifications`, `notification_reads`, `prayer_intercessions`가 존재하는가
- `compute_weekly_report()` 함수가 존재하는가
- Storage `attachments` 버킷이 생성되었는가

## 5. 자동화 운영

## 5.1 묵상 수집

구성:

- Edge Function: `fetch-devotional`
- 저장 테이블: `daily_devotionals`
- 현재 운영 경로: 외부 실행 경로 유지

확인 항목:

- 함수 배포됨
- OpenAI API key 설정됨
- 외부 사이트 접근 가능
- 실제 운영 경로에서 정상 실행됨

현재 확인된 사항:

- `fetch-devotional` 함수는 실제 실행 및 텔레그램 알림 정상 수신 기록이 있다.
- 반면 Supabase DB cron `fetch-devotional-daily`는 `schema "net" does not exist`로 실패 중인 것이 확인되었다.

운영 방침:

- 묵상 수집은 현재 정상 동작 중인 외부 실행 경로를 유지한다.
- 실패 중인 Supabase DB cron `fetch-devotional-daily`는 혼선을 막기 위해 제거한다.

제거 SQL:

```sql
select cron.unschedule('fetch-devotional-daily');
```

## 5.2 주간 마감

구성:

- DB 함수: `compute_weekly_report()`
- 결과 테이블: `weekly_reports`
- 운영 cron: `weekly-close-all-districts`

확인 항목:

- 함수 생성됨
- 권한/RLS가 맞는가
- `weekly-close-all-districts`가 등록됐는가
- 스케줄이 `매주 일요일 15:00 KST` 기준과 일치하는가

현재 확인된 사항:

- 기존 단일 구역 cron `weekly-close`는 제거했다.
- 멀티 구역 cron `weekly-close-all-districts`로 전환했다.
- 수동 실행으로 활성 구역 전체 `weekly_reports` 생성이 정상 확인되었다.

현재 운영 스케줄:

- `weekly-close-all-districts`
- `0 6 * * 0` (매주 일요일 06:00 UTC = 15:00 KST)

## 5.3 주보 PDF 파싱

구성:

- Edge Function: `parse-bulletin`
- 결과 테이블: `bible_studies`

확인 항목:

- 함수 배포됨
- OpenAI API key 설정됨
- PDF URL 접근 가능
- 스케줄 등록됨

주의:

- 코드 기준으로는 비발행 초안(`published=false`) 등록까지 구현돼 있다.
- 실제 운영에서는 등록 후 검토/발행 흐름이 정상인지 확인해야 한다.

## 6. 운영 점검 순서

권장 순서:

1. 프론트 환경 변수 설정
2. Supabase 마이그레이션 상태 확인
3. Storage 버킷 확인
4. Edge Function 배포
5. 함수 환경 변수 설정
6. 자동화 수동 호출 테스트
7. cron 등록 확인
8. 역할별 실사용 테스트

## 7. 역할별 실사용 테스트

최소 다음 계정으로 확인한다.

- `master`
- `leader`
- `member`

검증 항목:

- `member`는 일반 기능만 접근 가능
- `leader`는 `/admin` 접근 가능
- `master`는 `/districts` 접근 가능
- 다른 구역 데이터가 섞이지 않음

## 8. 트러블슈팅 포인트

### 8.1 로그인은 되지만 화면이 비정상

확인:

- `users` 테이블에 해당 사용자 프로필이 생성됐는가
- `district_id`가 유효한가
- `status`가 `pending`인지 `active`인지 확인

### 8.2 비밀번호 재설정 링크가 동작하지 않음

확인:

- `VITE_APP_URL` 값
- Supabase Auth Redirect URL 설정
- 실제 배포 URL과 일치 여부

### 8.3 첨부 업로드 실패

확인:

- `attachments` 버킷 존재 여부
- 버킷 권한 설정
- 업로드 파일 크기/형식 제한

### 8.4 자동화가 실행되지 않음

확인:

- Edge Function 배포 여부
- 함수 환경 변수 설정 여부
- cron 등록 여부
- 함수 로그 에러

메모:

- `fetch-devotional`은 현재 외부 실행 경로를 기준으로 운영한다.
- Supabase DB cron 실패 기록은 실제 성공 실행과 혼선을 만들 수 있으므로 제거 상태를 유지한다.

## 9. 관련 문서

- [운영준비체크리스트.md](/home/ubuntu/bethel803/docs/운영준비체크리스트.md)
- [01_서비스개요_현재구현.md](/home/ubuntu/bethel803/docs/기능설계/01_서비스개요_현재구현.md)
- [04_데이터_아키텍처.md](/home/ubuntu/bethel803/docs/기능설계/04_데이터_아키텍처.md)
- [05_개발로드맵.md](/home/ubuntu/bethel803/docs/기능설계/05_개발로드맵.md)
