# Vercel 전환 병행 운영안

## 1. 문서 목적

이 문서는 `bethel803`가 현재 운영을 유지하면서 Vercel 전환을 병행할 때의 원칙을 정리한다.

상황:

- 현재 서비스는 Firebase Hosting 기반 운영 경로가 남아 있다.
- 동시에 목표 아키텍처는 `Vercel + Supabase + GitHub Actions`다.
- 당분간은 운영 수정도 계속 발생한다.

따라서 전환 방식은 “즉시 절체”가 아니라 “병행 검증 후 컷오버”로 간다.

## 2. 기본 원칙

- 현재 운영 서비스는 당분간 유지한다.
- 새 Vercel 경로는 처음부터 운영 기준선으로 쓰지 않는다.
- Vercel은 preview/staging 검증 경로로 먼저 붙인다.
- 운영 반영은 컷오버 기준 충족 후에만 한다.

한 줄 규칙:

`운영은 유지하고, Vercel은 병행 검증용으로 먼저 도입한다.`

## 3. 현재 기준선

현재 저장소 기준 자동 배포 workflow:

- [deploy.yml](/home/ubuntu/bethel803/.github/workflows/deploy.yml)

현재 성격:

- `main` push 시 Firebase Hosting 배포
- 운영 URL 기준선은 아직 Firebase 경로에 가깝다

즉, 지금은 Firebase를 갑자기 지우는 단계가 아니다.

## 4. 병행 운영 구조

## 4.1 유지할 것

- Firebase 운영 배포 경로
- 현재 운영 URL
- 현재 긴급 수정 대응 흐름

## 4.2 새로 붙일 것

- Vercel preview 검증 경로
- staging Supabase 기반 테스트
- 수동 Vercel 배포 workflow

## 4.3 아직 하지 않을 것

- Firebase 운영 경로 즉시 제거
- Vercel production을 무조건 운영 기준선으로 승격
- preview 결과만 보고 운영 전환

## 5. GitHub workflow 운영 원칙

현재 운영 안정성을 위해 아래처럼 나눈다.

### 5.1 기존 Firebase workflow

역할:

- 현재 운영 서비스 유지

원칙:

- 당분간 유지
- 현재 운영 수정은 이 경로를 기준으로 계속 반영 가능

### 5.2 새 Vercel manual workflow

파일:

- [vercel-deploy-manual.yml](/home/ubuntu/bethel803/.github/workflows/vercel-deploy-manual.yml)

역할:

- staging 환경 기준 preview/prod 수동 검증
- 전환 리허설

원칙:

- 자동 트리거 아님
- `workflow_dispatch`만 사용
- 기존 운영 배포와 충돌시키지 않음

## 6. 권장 병행 운영 흐름

1. 현재 운영 수정은 기존 방식대로 처리
2. 같은 코드 또는 별도 브랜치에서 Vercel preview 검증
3. staging Supabase 기준으로 기능 확인
4. 충분히 안정화되면 Vercel production 리허설
5. 컷오버 기준 충족 시 운영 기준선을 Vercel로 이동

## 7. 수정이 계속 있을 때의 브랜치 전략

권장:

- `main`
  - 현재 운영 기준선
- `feat/*`
  - 일반 기능 개발
- `feat/vercel-transition-*`
  - 전환 관련 작업

원칙:

- 운영 긴급 수정과 전환 작업을 한 커밋에 섞지 않는다.
- 전환 작업은 문서/infra/workflow 단위로 작게 나눈다.

## 8. 컷오버 전까지의 판단 기준

아래가 완료되기 전까지는 Firebase 운영 경로를 유지하는 것이 안전하다.

- staging Supabase 준비 완료
- `015` 이후 스키마 검증 완료
- push 관련 함수 dry-run 검증 완료
- Preview -> staging 연결 안정화
- Vercel manual deploy 성공
- 운영 URL과 Auth redirect 정렬 검증 완료

## 9. 컷오버 시점

다음 조건이 모두 충족되면 컷오버를 검토한다.

1. Firebase와 Vercel 결과가 충분히 일치
2. staging 검증 완료
3. 운영 점검 체크리스트 완료
4. 롤백 절차 문서화 완료

그 전까지는 병행 운영이 기준이다.

## 10. 다음 단계

이 문서 이후 실제로 해야 할 일:

1. GitHub `staging` / `production` environment 준비
2. Vercel project 연결
3. manual workflow에 필요한 secrets/vars 입력
4. staging Supabase 확보
5. 첫 preview 수동 배포 검증
