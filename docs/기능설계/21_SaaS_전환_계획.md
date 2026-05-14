# SaaS 전환 계획: 다중 교회 기반

## 1. 목적

현재 `bethel803`는 한 교회 안의 여러 구역을 관리하는 구조다.
과금형 서비스로 전환하려면 구역보다 상위 개념인 `교회(church)`를 데이터와 권한의 최상위 경계로 둔다.

2단계의 목표는 결제 기능을 붙이는 것이 아니라, 먼저 아래를 가능하게 하는 것이다.

- 여러 교회가 같은 서비스 안에 공존
- 교회별 구역, 사용자, 성경공부, 일정, 기도제목 데이터 분리
- `master` 권한이 다른 교회 데이터에 접근하지 못하도록 제한
- 기존 벧엘교회 데이터는 기본 교회 1곳에 안전하게 귀속

## 2. 핵심 결정

### 2.1 최상위 테넌트

최상위 테넌트는 `churches`다.

```text
churches
  -> districts
    -> users
    -> bible_studies
    -> schedules
    -> weekly_reports
    -> notifications
```

### 2.2 기존 구역 구조 유지

기존 앱은 이미 `district_id` 중심으로 잘 묶여 있다.
따라서 모든 업무 테이블에 무리하게 `church_id`를 바로 복제하지 않고, 우선 `districts.church_id`와 `users.church_id`를 기준선으로 둔다.

직접 `church_id`가 필요한 테이블은 후속 단계에서 판단한다.

- `study_sources`: 교회별 주보 원본이 필요해질 때 추가
- `qt_contents`: 본문은 서비스 공통으로 둘 수 있으나, 구역장 코멘트는 교회/구역별 분리가 필요
- `daily_devotionals`: 서비스 공통 콘텐츠로 유지 가능

## 3. 기본 교회

기존 데이터는 아래 기본 교회에 귀속한다.

| 항목 | 값 |
|----|----|
| 이름 | 벧엘교회 |
| slug | `bethel` |
| plan | `legacy` |
| billing_status | `manual` |
| id | `00000000-0000-4100-a000-000000000001` |

이렇게 하면 현재 운영 데이터는 삭제 없이 SaaS 구조 안으로 들어간다.

## 4. 권한 원칙

기존 `master`는 전역 관리자처럼 동작할 수 있었다.
SaaS 구조에서는 `master`를 “자기 교회의 최고 관리자”로 해석한다.

권한 기준:

- `member`: 자기 데이터와 공개된 자기 교회/구역 데이터
- `leader`: 자기 구역 운영 데이터
- `master`: 자기 교회 안의 전체 구역과 사용자
- 서비스 운영자: 별도 역할이 필요하면 후속 단계에서 `service_admin` 또는 별도 운영 테이블로 분리

주의:

- 교회 A의 `master`가 교회 B의 `districts`, `users`, `weekly_reports`를 볼 수 있으면 안 된다.
- 현재 2단계 마이그레이션은 핵심 `church_id`와 주요 RLS부터 잠그고, 모든 업무 테이블의 완전한 교회 경계 검증은 staging에서 별도 점검한다.

## 5. 2단계 산출물

마이그레이션:

- [021_saas_church_scope.sql](/home/ubuntu/bethel803/supabase/migrations/021_saas_church_scope.sql)

주요 내용:

- `churches` 테이블 생성
- 기본 교회 `벧엘교회` 시드
- `districts.church_id` 추가
- `users.church_id` 추가
- `districts` 전역 이름 UNIQUE를 `(church_id, name)` UNIQUE로 변경
- `get_my_church_id()`, `is_church_master()`, `is_church_leader()` 헬퍼 추가
- 신규 가입 시 선택 구역의 교회로 `users.church_id` 자동 귀속
- `master` 역할 변경 권한을 같은 교회 안으로 축소

## 6. 후속 단계

### 6.1 온보딩

새 교회 개설 흐름을 만든다.

1. 교회 이름 입력
2. 교회 slug 생성
3. 첫 구역 생성
4. 첫 가입자를 `master`로 등록
5. 초대 링크 또는 가입 코드 발급

### 6.2 가입 흐름

현재 가입은 활성 구역 목록에서 선택하는 구조다.
SaaS에서는 교회 선택 또는 교회별 초대 링크가 필요하다.

권장:

- `/join/:churchSlug`
- 해당 교회의 활성 구역만 표시
- 가입자는 선택 구역의 교회에 자동 귀속

### 6.3 결제

결제는 DB 경계가 안정화된 뒤 붙인다.

초기 운영:

- `plan`
- `billing_status`
- `trial_ends_at`

자동 결제:

- Stripe 또는 Toss Payments 연동
- webhook으로 `churches.billing_status` 갱신
- `billing_status`에 따라 구역 생성, 신규 가입, 알림 발송 같은 기능 제한

### 6.4 RLS 감사

다음 테이블은 staging에서 교회 A/B 더미 데이터를 넣고 교차 접근 테스트가 필요하다.

- `bible_studies`
- `study_answers`
- `prayer_requests`
- `prayer_responses`
- `prayer_intercessions`
- `bible_reading_logs`
- `schedules`
- `attendances`
- `weekly_reports`
- `notifications`
- `push_subscriptions`
- `push_deliveries`
- `qt_contents`
- `qt_responses`
- `streaks`

## 7. 권장 진행 순서

1. `021_saas_church_scope.sql`을 staging Supabase에 적용
2. 기본 교회/구역/사용자 귀속 결과 확인
3. 기존 로그인, 관리자, 구역 관리, 주간 보고 회귀 테스트
4. 교회 B 더미 데이터 추가
5. 교회 A master가 교회 B 데이터를 볼 수 없는지 RLS 테스트
6. `/join/:churchSlug` 온보딩 설계와 구현
7. 무료 체험/수동 과금 상태 표시
8. 결제 webhook 연동
