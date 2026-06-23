import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { supabase } from './supabase';

// 네이티브 앱(Capacitor) 여부
export const isNativeApp = () => Capacitor.isNativePlatform();

// OAuth 복귀용 커스텀 스킴 딥링크.
// 주의: 스킴에 점(.)이 있으면 Supabase(GoTrue)가 Redirect URL 매칭에 실패한다.
// 따라서 appId(im.moco)와 별개로 점 없는 스킴 'moco'를 쓴다.
// Supabase Auth → URL Configuration → Redirect URLs 에 반드시 등록 (prod·staging):
//   moco://auth-callback
const APP_SCHEME = 'moco';
export const NATIVE_AUTH_REDIRECT = `${APP_SCHEME}://auth-callback`;

// 네이티브에서 OAuth 로그인.
// 인앱 WebView는 Google OAuth가 차단되므로, 시스템 브라우저(Custom Tabs /
// SFSafariViewController)로 열고 딥링크로 복귀한다.
export async function nativeOAuthSignIn(provider: 'google' | 'kakao') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: NATIVE_AUTH_REDIRECT,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (data?.url) {
    await Browser.open({ url: data.url, presentationStyle: 'popover' });
  }
}

// 네이티브에서 소셜 계정 연결(이미 로그인된 상태에서 identity 추가).
export async function nativeLinkIdentity(provider: 'google' | 'kakao') {
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: {
      redirectTo: NATIVE_AUTH_REDIRECT,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (data?.url) {
    await Browser.open({ url: data.url, presentationStyle: 'popover' });
  }
}

let deepLinkInitialized = false;

// 앱 시작 시 1회 등록. 딥링크 복귀를 받아 세션을 교환한다.
export function initNativeAuthDeepLinks() {
  if (!isNativeApp() || deepLinkInitialized) return;
  deepLinkInitialized = true;

  App.addListener('appUrlOpen', async ({ url }) => {
    // 주의: url에는 토큰이 들어있으므로 전체를 로그로 남기지 않는다.
    if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return;
    console.log('[nativeAuth] OAuth 콜백 수신');
    let ok = false;
    try {
      // PKCE 플로우: ?code=... 를 세션으로 교환
      const parsed = new URL(url);
      const code = parsed.searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.error('[nativeAuth] exchangeCodeForSession 에러', error.message);
        else ok = true;
      } else {
        // 암시적(implicit) 플로우: #access_token=...&refresh_token=...
        const hash = url.split('#')[1];
        if (hash) {
          const params = new URLSearchParams(hash);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) console.error('[nativeAuth] setSession 에러', error.message);
            else {
              ok = true;
              console.log('[nativeAuth] 로그인 성공, user:', data.session?.user?.id);
            }
          }
        }
      }
    } catch (e) {
      console.error('[nativeAuth] 세션 교환 실패', e);
    }

    // 시스템 브라우저 닫기 (열려 있던 경우)
    await Browser.close().catch(() => {});

    // 세션이 localStorage에 저장됐으므로 앱을 다시 진입시켜 로그인 상태로 부팅한다.
    // (onAuthStateChange가 딥링크 복귀 후 화면 전환을 못 잡는 경우 대비 — 가장 확실)
    if (ok) {
      window.location.replace('/dashboard');
    }
  });
}
