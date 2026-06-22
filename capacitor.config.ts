import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // appId는 스토어 공개 후 변경 불가(변경 시 새 앱으로 취급). 테스트 단계에서 확정 권장.
  appId: 'kr.or.bethel.guzic',
  appName: '벧엘구역',
  // vite build 산출물 디렉토리
  webDir: 'dist',
  // 빠른 테스트용: 아래 server.url 주석을 풀면 네이티브 셸이 실제 배포 URL을 로드한다
  // (번들 없이 즉시 확인 가능, 단 네트워크 필요. OAuth 리디렉트도 실제 https라 수월).
  // 정식 빌드 시에는 반드시 주석 처리하여 dist 번들을 사용한다.
  // server: {
  //   url: 'https://project-9zxj4.vercel.app',
  //   cleartext: false,
  // },
  ios: {
    contentInset: 'always',
  },
};

export default config;
