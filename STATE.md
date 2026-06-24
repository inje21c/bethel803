# STATE.md — bethel803

> 이 파일은 **변하는 것**만 담는다. "지금 어디까지 했고, 다음에 뭘 할 차례인가."
> 장황한 일지 금지. 다음 세션(다른 기기/다른 도구)이 읽을 **인계 메모** 3~5줄.
> 세션 끝낼 때 갱신 → commit → push.

---

## 마지막 업데이트
- 날짜: 2026-06-24
- 장소/도구: 회사 · 윈도우 · C:\dev\bethel803-web

## 지금까지 (EC2 → 로컬 이전)
- EC2에서 main 웹 개발을 로컬로 옮기는 검증 **완료**.
- 회사 윈도우 `C:\dev\bethel803-web`(main)에서 npm run dev 정상 기동,
  신규 가입·로그인까지 확인 → Supabase 연동 작동 실증.
- EC2 측 bethel803은 GitHub main과 동기화 완료(docs 반영, manifest는 빌드 생성이라 제외).

## 다음에 할 차례
- [ ] 집(맥북)에서도 SSH로 bethel803-web clone → 동일 검증
- [ ] push→Vercel Production 자동배포 1회 확인 (사소한 수정으로)
- [ ] EC2 나머지 9개 레포 미push 변경 일괄 점검 → EC2 stop → terminate
- [ ] feature 브랜치 19개 정리 (별도 세션)

## 막힌 것 / 결정 대기
- 없음 (A 검증 통과)

## 건드리면 안 되는 것 / 주의
- **feat/capacitor에 stash 보관 중인 .gitignore 변경 있음** → 그 브랜치 작업 재개 시
  `git stash pop`으로 복원할 것. (잊으면 .playwright-cli 무시 설정 사라짐)
- 로컬 .env.local은 가능하면 **preview Supabase**를 볼 것. prod 직접 연결은 운영 데이터 위험.
- 기존 로그인 계정 일부가 로컬에서 안 됨(prod/preview 계정 분리 추정) → 검증엔 영향 없음.

## 나중에 할 것 (백로그)
- docs-only 커밋이 Vercel 빌드 유발 → .vercelignore 또는 Ignored Build Step으로 정리
- 윈도우 홈(C:\Users\NH) 폴더 대청소: GitHub 레포는 C:\dev로 통합

---
<!-- 이전 인계 메모는 이 아래에 짧게 누적. 오래된 건 지워도 됨. -->
