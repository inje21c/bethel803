import { registerSW } from 'virtual:pwa-register';

// 새 버전 SW가 대기 중일 때, 사용자가 입력 중일 수 있는 활성 탭을 강제로
// 새로고침하지 않는다. 대신 탭이 백그라운드로 전환되는 시점에 활성화시켜서
// 다음에 다시 열 때 항상 최신 코드로 시작하도록 한다.
// (여러 날 방치 후 재실행 시 구버전 SW가 존재하지 않는 자산을 요청해
// 흰 화면으로 멈추는 문제의 근본 원인 대응)
let updatePending = false;

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updatePending = true;
    tryActivateInBackground();
  },
  onOfflineReady() {},
});

function tryActivateInBackground() {
  if (updatePending && document.visibilityState === 'hidden') {
    updatePending = false;
    void updateSW(false);
  }
}

document.addEventListener('visibilitychange', tryActivateInBackground);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 새 SW가 이 탭을 인수함 — 백그라운드 상태에서만 리로드해 활성 입력을 방해하지 않는다.
    if (document.visibilityState === 'hidden') {
      window.location.reload();
    }
  });
}
