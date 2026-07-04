# EXPOSURE_REPORT.md — 공개 레포 위생 스캔 결과

> 작성: 2026-07-04 (Phase 1 완료)
> 히스토리 재작성: 2026-07-04 (Phase 3 완료)
> 스캔 대상: 워킹트리 전체 + git 전체 히스토리
> 상태 범례: `대기` = 사람 승인 필요 / `완료` = 검증 끝

---

## 요약

| 계층 | 건수 | 상태 |
|---|---|---|
| L1 크리덴셜 | 2건 | 완료 |
| L2 제3자 개인정보 | 4건 | 완료 |
| L2 결정 대기 | 1건 | 유지 결정 (공개 연락처) |
| L3 히스토리 잔존 | 전 항목 | 완료 (filter-repo 재작성) |

---

## L1 — 크리덴셜

| 파일:라인 | 계층 | 내용 요약 | 처리 | 상태 |
|---|---|---|---|---|
| `docs/개발일지_2026-06-22.md:78` | L1 | staging 임시 비밀번호 평문 기록 | 회전 + `[REDACTED — rotated 2026-07-04]` 치환 | **완료** |
| `scripts/seed_tenant_fixtures.mjs:46` | L1 | 테스트 고정 비밀번호 하드코딩 | `SEED_PASSWORD` 환경변수로 교체 | **완료** |

---

## L2 — 제3자 개인정보

| 파일:라인 | 계층 | 내용 요약 | 처리 | 상태 |
|---|---|---|---|---|
| `docs/운영/베타테스터_안내메일_템플릿.md:45` | L2 | 테스터 실명 + 교회 UUID | `테스터H` / `UUID-B` 치환 | **완료** |
| `docs/운영/베타테스터_안내메일_템플릿.md:43` | L2 | 테스터 교회명 + UUID + 표시명 | `베타교회A` / `UUID-A` / `테스터A` 치환 | **완료** |
| `docs/기능설계/모임우선_아키텍처_재설계.md:135` | L2 | 실명·UUID 2개·표시명 동시 등장 | 동일 치환 | **완료** |
| `docs/기능설계/모임우선_아키텍처_재설계.md:141` | L2 | 실명 재등장 + 역할 설명 | 치환 | **완료** |

---

## L2 — 결정 완료 (본인 이메일)

| 항목 | 결정 | 사유 |
|---|---|---|
| `cmhyun@gmail.com` (Privacy/Business/ChurchSignup 페이지) | **공개 유지** | 개인정보 보호책임자 공개 연락처로 의도적 사용 |
| `cmhyun@gmail.com` (supabase/migrations superadmin 하드코딩) | **유지** (기술 부채로 별도 관리) | 이메일 자체는 공개 정보; 데이터 기반 승격 전환은 별도 태스크 |

---

## L3 — 히스토리 재작성 결과

| 커밋 SHA (구) | 포함 문자열 | 처리 |
|---|---|---|
| `423561e` | [REDACTED - rotated 2026-07-04] | filter-repo 재작성 완료 |
| `9b6fa77` | 테스터H, UUID-A, UUID-B | filter-repo 재작성 완료 |
| 다수 | cmhyun@gmail.com | 유지 결정 |

**재작성 범위:** 전체 369개 커밋 / 2026-07-04 force-push 완료

---

## 후속 조치 (사람)

- [ ] GitHub Support에 캐시 삭제 요청: "I force-pushed to remove sensitive data (PII/credential) from inje21c/bethel803. Please run garbage collection and remove cached views of the old commits."
- [ ] 레포 Public 재전환 (위생 작업 완료 후)
- [ ] 로컬 기기 re-clone (집 맥북, 회사 윈도우 각각)
- [ ] 24시간 후 GitHub 웹 검색으로 잔존 인덱스 확인

---

## Phase 5 — 재발 방지 (진행 예정)

GitHub Actions gitleaks 워크플로우 및 CLAUDE.md 문서 작성 규칙 추가.
