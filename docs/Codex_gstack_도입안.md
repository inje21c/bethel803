# bethel803 Codex 중심 gstack 도입안

**작성일:** 2026-04-09  
**대상:** `bethel803` 프로젝트의 AI-assisted 개발 운영 체계 정립  
**전제:** 본 프로젝트는 Claude Code 중심이 아니라 Codex 중심으로 운영한다.

## 1. 문서 목적

이 문서는 `garrytan/gstack`의 개발 원칙과 역할 분리 방식을 `bethel803`에 맞게 재해석하여, Codex 중심 개발 운영 체계로 도입하기 위한 실행안을 정리한다.

이 문서는 다음을 목표로 한다.

- `gstack`의 장점을 가져오되 현재 Codex 환경과 충돌하지 않게 적용한다.
- `bethel803`의 현재 단계에 맞는 우선 도입 범위를 정한다.
- 스킬, 에이전트 역할, 문서 운영, 품질 게이트를 하나의 운영 체계로 묶는다.

## 2. 적용 배경

현재 `bethel803`는 신규 기능 대량 개발 단계보다 운영 활성화와 안정화 단계에 가깝다.

현재 상태 요약:

- 핵심 기능은 대부분 구현되어 있다.
- Supabase 마이그레이션, Edge Function, Storage 연동 코드가 저장소에 포함되어 있다.
- 남은 핵심 과제는 운영 환경 활성화, 역할별 실사용 검증, 관리자 성능 정리, 문서 최신화다.

이 상태는 `gstack`의 다음 장점과 잘 맞는다.

- 역할 분리: 전략, 아키텍처, 디자인, QA, 배포를 따로 다룬다.
- 리뷰 게이트: 구현 후 독립 시각으로 다시 점검한다.
- 문서 동기화: 코드 변경 후 문서 갱신을 작업의 일부로 본다.
- 완결성 우선: 작은 범위는 임시 처리보다 끝까지 마무리한다.

## 3. Codex 중심 도입 원칙

`gstack`를 이 프로젝트에 적용할 때는 원본 도구 체계를 그대로 복제하지 않고, 아래 원칙으로 Codex용 운영 규칙으로 번역한다.

### 3.1 도입 원칙

- Codex를 기본 실행 엔진으로 사용한다.
- `gstack`는 설치 대상이 아니라 운영 원칙과 역할 설계의 참고 모델로 사용한다.
- 각 작업은 "하나의 큰 AI"가 아니라 "분리된 역할"로 사고한다.
- 신규 기능보다 운영 안정화와 품질 게이트를 우선한다.
- 문서 수정은 선택이 아니라 완료 조건에 포함한다.

### 3.2 Codex 환경에 맞춘 해석

- slash command 중심 운영 대신 문서화된 작업 라우팅 규칙을 사용한다.
- gstack의 skill 개념은 `Codex 작업 프로토콜`과 `체크리스트 문서`로 치환한다.
- gstack의 agent 개념은 Codex의 메인 작업 흐름 + 필요 시 명시적 서브에이전트 위임 구조로 치환한다.
- 브라우저 QA는 필요 시 별도 검증 단계로 두되, 현재 저장소에서는 우선 체크리스트 기반 QA 흐름을 정착시킨다.

### 3.3 현재 Codex 제약 반영

- 병렬 서브에이전트는 사용자가 명시적으로 위임하거나 필요를 승인한 경우에만 사용한다.
- 따라서 기본 운영은 메인 Codex 에이전트 중심으로 설계한다.
- 서브에이전트는 필수 구조가 아니라 고난도 작업 분산을 위한 확장 구조로 간주한다.

## 4. bethel803에 적용할 gstack 핵심 원칙

다음 원칙만 우선 채택한다.

### 4.1 Search Before Building

새로운 인프라, 새 패턴, 새 배포 전략을 도입하기 전에 먼저 조사하고 기존 구조와 충돌 여부를 확인한다.

`bethel803`에 바로 적용할 대상:

- PWA 도입 여부
- 관리자 화면 성능 최적화 방식
- Supabase cron 운영 경로
- Edge Function 배포/운영 패턴

### 4.2 Boil the Lake

범위가 작은 작업은 90% 상태로 남기지 않고 끝까지 마무리한다.

`bethel803`에서의 우선 적용 대상:

- 역할별 운영 시나리오 검증
- 운영 체크리스트 완주
- 기능 수정 후 테스트 보강
- 기능 수정 후 문서 갱신

### 4.3 Role-Separated Thinking

하나의 요청도 아래 관점으로 나누어 본다.

- 전략적으로 필요한가
- 구조적으로 안전한가
- 사용자 경험이 자연스러운가
- 운영 중 깨지지 않는가
- 문서와 배포 절차까지 완료되었는가

### 4.4 Docs as Runtime Assets

문서는 참고 자료가 아니라 작업 흐름의 일부다.

운영 기준:

- 기능 변경 후 관련 문서가 갱신되지 않으면 작업이 끝난 것이 아니다.
- 운영 절차가 바뀌면 `OPERATIONS.md`, `운영준비체크리스트.md`, `운영점검TODO.md` 중 적어도 하나 이상이 함께 갱신되어야 한다.

## 5. bethel803 전용 Codex 스킬 체계

본 프로젝트에서는 gstack의 원형을 그대로 쓰지 않고, 아래의 Codex 전용 작업 스킬 체계로 정리한다.

### 5.1 전략/기획 계열

| Codex 스킬 이름 | gstack 참조 | 목적 |
|------|------|------|
| `codex:office-hours-lite` | `/office-hours` | 기능 요청을 받았을 때 구현 전에 가치와 범위를 재정의 |
| `codex:ceo-review-lite` | `/plan-ceo-review` | 요청이 너무 작거나 좁을 때 더 가치 있는 방향으로 재해석 |
| `codex:autoplan-lite` | `/autoplan` | 큰 작업을 전략, 구조, QA, 문서 단위로 자동 분해 |

적용 대상:

- 신규 기능 아이디어
- 운영 개선 우선순위 재정렬
- PWA 도입 여부 판단

### 5.2 아키텍처/구현 계열

| Codex 스킬 이름 | gstack 참조 | 목적 |
|------|------|------|
| `codex:eng-review-bethel803` | `/plan-eng-review` | Supabase, RLS, 멀티구역, Edge Function, cron 구조 점검 |
| `codex:investigate-bethel803` | `/investigate` | 버그 발생 시 원인 규명 우선 원칙 적용 |
| `codex:review-bethel803` | `/review` | 구현 후 회귀/운영 리스크 중심 리뷰 |

적용 대상:

- 인증, 권한, 멀티구역 관련 변경
- `src/lib/api.ts` 대규모 수정
- 마이그레이션 추가
- 자동화 로직 수정

### 5.3 QA/운영 계열

| Codex 스킬 이름 | gstack 참조 | 목적 |
|------|------|------|
| `codex:qa-roles-bethel803` | `/qa`, `/qa-only` | `master`, `leader`, `member`, `pending` 역할 검증 |
| `codex:ops-readiness-bethel803` | `/qa-only`, `/document-release` | 운영 체크리스트 기반 점검 |
| `codex:document-release-bethel803` | `/document-release` | 코드와 문서 상태 동기화 |

적용 대상:

- 배포 직전 점검
- 운영 자동화 변경
- 첨부 업로드 정책 변경
- 승인/권한 흐름 변경

### 5.4 성능/보안 계열

| Codex 스킬 이름 | gstack 참조 | 목적 |
|------|------|------|
| `codex:benchmark-admin` | `/benchmark` | 관리자 화면 번들, 렌더링, 로딩 병목 분석 |
| `codex:cso-lite` | `/cso` | 권한, 공개 버킷, 서비스 키 경계, RLS 점검 |
| `codex:guard-ops` | `/guard`, `/careful` | 운영/배포 명령 전 안전 확인 프로토콜 |

적용 대상:

- 관리자 화면 최적화
- Supabase Storage 정책 변경
- 운영 배포/마이그레이션

## 6. bethel803 전용 에이전트 역할 구조

Codex 중심 운영에서는 아래 역할 모델을 기본으로 사용한다.

### 6.1 기본 역할

| 역할 | 책임 범위 | 주 사용 시점 |
|------|------|------|
| Product/Ops Agent | 기능 가치, 운영 우선순위, 범위 조정 | 새 요청 시작 시 |
| Architecture Agent | DB, RLS, API, Supabase, 자동화 구조 점검 | 구현 전/중 |
| Implementation Agent | 실제 코드 수정과 테스트 | 구현 단계 |
| QA Agent | 역할별 시나리오, 회귀 검증, 운영 흐름 확인 | 구현 후 |
| Docs/Release Agent | 운영 문서, 체크리스트, 릴리스 노트 정리 | 마무리 단계 |
| Security Agent | 권한, 공개 경계, 설정 누락 위험 검토 | 고위험 변경 전후 |

### 6.2 Codex 실행 방식

기본은 메인 Codex 에이전트 1개가 위 역할을 순차적으로 전환하며 수행한다.

기본 순서:

1. Product/Ops 관점으로 범위 정리
2. Architecture 관점으로 위험 점검
3. 구현
4. QA
5. 문서/릴리스 정리

### 6.3 서브에이전트 사용 원칙

서브에이전트는 선택적이다.

사용 조건:

- 사용자가 명시적으로 병렬 작업 또는 위임을 요청한 경우
- 프론트엔드와 Supabase SQL처럼 쓰기 범위가 명확히 분리되는 경우
- 메인 작업 흐름을 막지 않는 독립 조사 작업이 있는 경우

권장 분할 예시:

- Worker A: 관리자 화면 성능 최적화
- Worker B: 운영 문서 갱신
- Explorer A: RLS 영향 범위 조사
- Explorer B: 테스트 누락 구간 조사

## 7. Codex 작업 라우팅 규칙

이 프로젝트에서는 사용자 요청 유형에 따라 아래처럼 라우팅한다.

| 요청 유형 | 기본 라우팅 |
|------|------|
| 새 기능 아이디어 | `office-hours-lite` -> `ceo-review-lite` -> `autoplan-lite` |
| 구조 변경 | `eng-review-bethel803` -> 구현 -> `review-bethel803` |
| 버그 수정 | `investigate-bethel803` -> 구현 -> 관련 테스트 추가 |
| 운영 점검 | `ops-readiness-bethel803` |
| 역할별 검증 | `qa-roles-bethel803` |
| 보안/권한 우려 | `cso-lite` |
| 배포 전 최종 점검 | `review-bethel803` -> `document-release-bethel803` |

## 8. 현재 bethel803에 우선 적용할 영역

지금 가장 효과가 큰 도입 대상은 아래 4개다.

### 8.1 운영 활성화

대상:

- Supabase 환경 변수
- Edge Function 배포
- cron 등록 확인
- Storage 버킷 확인

적용 방식:

- `eng-review-bethel803`로 운영 전제 조건 정리
- `ops-readiness-bethel803`로 문서 기반 점검
- 완료 후 `document-release-bethel803`로 문서 상태 갱신

### 8.2 역할별 QA

대상:

- `master`
- `leader`
- `member`
- `pending`

적용 방식:

- `qa-roles-bethel803` 체크리스트를 기준으로 시나리오화
- 실패 항목은 버그 티켓 또는 TODO로 즉시 환원

### 8.3 관리자 성능 최적화

배경:

- 관리자 관련 코드와 번들 크기가 큰 편이다.
- 운영 문서도 성능 정리를 남은 과제로 본다.

적용 방식:

- `benchmark-admin`으로 병목 확인
- `eng-review-bethel803`로 분할 전략 결정
- 구현 후 `review-bethel803` 수행

### 8.4 문서 동기화

대상 문서:

- `README.md`
- `docs/OPERATIONS.md`
- `docs/운영준비체크리스트.md`
- `docs/운영점검TODO.md`
- 관련 기능 설계 문서

적용 방식:

- 기능 수정 후 관련 문서 1개 이상 동시 갱신
- 운영 경로 변경 시 운영 문서 우선 갱신

## 9. bethel803용 작업 완료 정의

Codex 중심 운영에서 작업은 아래 조건을 만족해야 완료로 본다.

### 9.1 일반 기능 작업

- 코드 수정 완료
- 관련 테스트 추가 또는 기존 테스트 통과
- 운영 영향 여부 판단 완료
- 관련 문서 반영 완료

### 9.2 운영 관련 작업

- 코드 또는 설정 반영 완료
- 수동 검증 또는 체크리스트 확인 완료
- 운영 문서 반영 완료
- 재실행/장애 대응 경로가 문서화됨

### 9.3 고위험 작업

다음 작업은 반드시 리뷰 단계를 거친다.

- Auth 흐름 수정
- RLS/권한 정책 수정
- Supabase 함수 환경 변수/배포 구조 변경
- cron 및 자동화 로직 변경
- 첨부파일 공개 정책 변경

## 10. 권장 문서/폴더 구조

Codex 중심 gstack 도입을 위해 아래 구조를 권장한다.

```text
docs/
  Codex_gstack_도입안.md
  codex-workflows/
    office-hours-lite.md
    eng-review-bethel803.md
    qa-roles-bethel803.md
    ops-readiness-bethel803.md
    document-release-bethel803.md
```

설명:

- 본 문서는 상위 원칙과 운영 모델을 설명한다.
- `docs/codex-workflows/`는 실제 실행 절차 문서 묶음이다.
- 각 workflow 문서는 "언제 쓰는지", "입력", "실행 순서", "완료 조건"을 가져야 한다.

## 11. 30일 도입 계획

### 1주차

- 본 문서를 기준으로 Codex 운영 원칙 합의
- `ops-readiness-bethel803` 초안 작성
- `qa-roles-bethel803` 초안 작성

### 2주차

- 운영 활성화 작업에 `eng-review-bethel803` 적용
- 역할별 QA 시나리오를 실제 체크리스트로 전환
- 문서 수정 시 `document-release-bethel803` 규칙 시범 적용

### 3주차

- 관리자 화면 성능 이슈에 `benchmark-admin` 적용
- `review-bethel803` 기준 초안 수립
- 고위험 변경에 리뷰 게이트 시범 적용

### 4주차

- 1회 이상 실제 기능 작업을 전체 파이프라인으로 수행
- 회고 문서 작성
- 불필요한 규칙은 제거하고 반복 가치가 높은 규칙만 고정

## 12. 비도입 항목

현재 단계에서는 아래 항목을 바로 도입하지 않는다.

- gstack 전체 설치를 팀 표준으로 강제
- 모든 작업에 항상 서브에이전트 병렬 사용
- 브라우저 자동화 기반 전면 QA 의무화
- 모든 요청에 과도한 다단계 검토 추가

이유:

- 현재 프로젝트 규모와 팀 운영 방식상 오버헤드가 커질 수 있다.
- `bethel803`는 우선 운영 안정화가 목적이므로, 품질 게이트는 가볍지만 확실해야 한다.

## 13. 최종 권장안

`bethel803`의 gstack 도입은 다음 방식이 가장 적절하다.

1. gstack를 "도구 세트"보다 "역할 분리형 운영 원칙"으로 받아들인다.
2. Codex를 메인 실행 엔진으로 유지한다.
3. 운영 활성화, 역할별 QA, 성능 개선, 문서 동기화 4개 영역에 먼저 적용한다.
4. 서브에이전트는 선택적으로만 사용한다.
5. 작업 완료 조건에 테스트와 문서 반영을 포함한다.

즉, 본 프로젝트에서의 성공적인 gstack 도입은 "새 AI 프레임워크 설치"가 아니라 "Codex 작업을 더 구조화된 운영 체계로 바꾸는 것"이다.

## 14. 후속 작업

이 문서 다음 단계로 권장하는 작업은 아래와 같다.

1. `docs/codex-workflows/ops-readiness-bethel803.md` 작성
2. `docs/codex-workflows/qa-roles-bethel803.md` 작성
3. `docs/codex-workflows/review-bethel803.md` 작성
4. 관리자 성능 개선 작업에 시범 적용
5. 운영 활성화 점검에 시범 적용

*최초 작성일: 2026-04-09*
