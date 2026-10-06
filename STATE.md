# STATE.md — bethel803

> 이 파일은 **변하는 것**만 담는다. "지금 어디까지 했고, 다음에 뭘 할 차례인가."
> 장황한 일지 금지. 다음 세션(다른 기기/다른 도구)이 읽을 **인계 메모** 3~5줄.
> 세션 끝낼 때 갱신 → commit → push.

---

## 마지막 업데이트
- 날짜: 2026-10-06
- 장소/도구: 회사 · 윈도우 · C:\dev\bethel803-web · Claude Code

## 지금까지
- 성경 완독(회독) 기능 추가 (migration 061 + api + BibleReading UI + 구역장 대시보드).
  완독 후 "다시 읽기" 리셋으로 누적 장수 재증가 문제 해소. 완독 횟수 배지.
- main 직접 커밋 → staging DB 자동 적용(workflow), Vercel prod 프론트 배포.

## 다음에 할 차례
- [ ] **prod DB에 migration 061 수동 적용** (supabase-prod.yml, confirm=deploy-prod)
      → 안 하면 prod에서 완독 RPC 에러. 프론트는 main 머지로 이미 prod 배포됨.
- [ ] staging에서 완독→재시작 플로우 실제 검증
- [ ] dance-2027 EC2→로컬 이전
- [ ] EC2 나머지 레포(7개) 미push 변경 점검
- [ ] EC2 stop → 관찰 → terminate
- [ ] feature 브랜치 19개 정리 (별도 세션)
- [ ] 집 맥북 vcc-game 검증 (vercel dev, vibecoding001 계정)

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
