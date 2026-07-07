# Public Repository Hygiene Report / 공개 레포 위생 보고서

> Public document / 공개 문서
> Initial review / 최초 점검: 2026-07-04
> Last reviewed / 마지막 점검: 2026-07-07

## English Summary

This report records the repository hygiene work completed before presenting bethel803 as a public GitHub project. The review focused on credentials, personal information, historical commits, and documentation practices.

The repository is intended to be public for portfolio, review, and learning purposes. It is not currently released under an open-source license.

## 한국어 요약

이 문서는 bethel803을 공개 GitHub 프로젝트로 보여주기 전에 수행한 저장소 위생 점검을 정리합니다. 점검 범위는 자격 증명, 개인정보, Git 히스토리, 문서 작성 관행입니다.

이 저장소는 포트폴리오, 리뷰, 학습 목적의 공개 저장소입니다. 현재 오픈소스 라이선스로 배포된 것은 아닙니다.

## 1. Review Scope / 점검 범위

| Scope | Description |
| --- | --- |
| Working tree / 현재 워킹트리 | Files currently present in the repository |
| Git history / Git 히스토리 | Historical commits before publication |
| Documentation / 문서 | Design, operations, and build-log documents |
| Scripts / 스크립트 | Seed, migration, and operations helper scripts |
| Public presentation / 공개 표시 | README, screenshots, links, and report documents |

## 2. Risk Classification / 위험 분류 기준

| Level | English | Korean |
| --- | --- | --- |
| L1 | Credentials or secrets that could grant access | 접근 권한을 줄 수 있는 자격 증명 또는 시크릿 |
| L2 | Personal or third-party identifying information | 개인 또는 제3자 식별 정보 |
| L3 | Historical residue after file cleanup | 파일 정리 이후에도 히스토리에 남은 흔적 |
| L4 | Public-document quality issues | 공개 문서 품질과 맥락 문제 |

## 3. Completed Cleanup / 완료된 정리

| Category | Result | Status |
| --- | --- | --- |
| Credentials / 자격 증명 | Removed or rotated where needed | Complete / 완료 |
| Test passwords / 테스트 비밀번호 | Replaced with environment-driven values | Complete / 완료 |
| Third-party names / 제3자 이름 | Replaced with sample labels | Complete / 완료 |
| Third-party IDs / 제3자 식별자 | Replaced or anonymized | Complete / 완료 |
| Public contact information / 공개 연락처 | Kept only where intentionally public | Reviewed / 검토 완료 |
| Git history / Git 히스토리 | Rewritten where sensitive historical data had existed | Complete / 완료 |
| README assets / README 이미지 | Kept to sample or privacy-safe screens | Complete / 완료 |

## 4. Current Public Posture / 현재 공개 상태

English:

- The repository can be read as a public portfolio and architecture record.
- Screenshots are intended to avoid real member or church-sensitive data.
- Documentation has been adjusted toward public-facing context.
- Operational instructions intentionally avoid private production credentials.
- The source code remains all-rights-reserved unless a license is added later.

한국어:

- 이 저장소는 공개 포트폴리오와 아키텍처 기록으로 읽을 수 있습니다.
- 스크린샷은 실제 구성원 정보나 교회 내부 민감 정보가 드러나지 않도록 구성합니다.
- 문서는 공개 독자가 이해할 수 있는 맥락으로 정리합니다.
- 운영 문서는 비공개 운영 자격 증명을 포함하지 않습니다.
- 별도 라이선스가 추가되기 전까지 소스코드는 모든 권리가 보유됩니다.

## 5. Public Documentation Rules / 공개 문서 작성 규칙

Use these rules when adding or updating documents:

- Do not include real names, phone numbers, private emails, passwords, tokens, or third-party UUIDs.
  실명, 전화번호, 비공개 이메일, 비밀번호, 토큰, 제3자 UUID를 포함하지 않습니다.
- Use sample labels such as `Member A`, `Leader A`, `Tester A`, or `Church A`.
  `Member A`, `Leader A`, `Tester A`, `Church A` 같은 샘플 표기를 사용합니다.
- Use relative repository links instead of local absolute paths.
  로컬 절대경로 대신 저장소 상대 링크를 사용합니다.
- Explain Korean-only operational context with a short English summary.
  한국어 운영 맥락 문서에는 짧은 영어 요약을 함께 둡니다.
- Treat design documents as public permalinks once committed.
  커밋된 설계 문서는 공개 permalink로 볼 수 있다고 가정합니다.

## 6. Recommended Checks / 권장 점검

Before making the repository public or after major documentation updates:

```bash
rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' "password|secret|token|service_role|private key" .
```

Additional manual checks / 추가 수동 점검:

- Search for real names and private contact information.
  실명과 비공개 연락처를 검색합니다.
- Review screenshots and generated assets.
  스크린샷과 생성 이미지를 확인합니다.
- Check documents linked directly from the README.
  README에서 직접 연결된 문서를 확인합니다.
- Confirm `.env` files are not committed.
  `.env` 파일이 커밋되지 않았는지 확인합니다.

## 7. Follow-Up Items / 후속 항목

| Item | Status |
| --- | --- |
| Keep README-linked documents public-friendly / README 연결 문서 공개용 정리 유지 | In progress / 진행 중 |
| Continue avoiding real user data in screenshots / 스크린샷 실사용자 정보 배제 | Ongoing / 지속 |
| Run secret scans before major publication changes / 주요 공개 변경 전 시크릿 스캔 | Ongoing / 지속 |
| Re-check GitHub-rendered pages after publishing / 공개 후 GitHub 렌더링 확인 | Recommended / 권장 |

## 8. Related Documents / 관련 문서

- [README](./README.md)
- [Service Overview / 서비스 개요](./docs/기능설계/01_서비스개요_현재구현.md)
- [Core Features / 핵심 업무 기능](./docs/기능설계/02_핵심업무기능.md)
- [Data Architecture / 데이터 아키텍처](./docs/기능설계/04_데이터_아키텍처.md)
- [Operations Guide / 운영 가이드](./docs/OPERATIONS.md)
