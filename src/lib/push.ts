export interface BrowserPushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string;
  userAgent: string | null;
  appVersion: string | null;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();
const APP_VERSION = import.meta.env.VITE_APP_VERSION?.trim() || null;

function bufferToBase64Url(value: ArrayBuffer | null): string {
  if (!value) return '';
  const bytes = new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function getPlatformLabel() {
  const ua = navigator.userAgent.toLowerCase();
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ((navigator as Navigator & { standalone?: boolean }).standalone === true);

  if (/android/.test(ua) && /chrome/.test(ua)) {
    return isStandalone ? 'android-webapp' : 'android-chrome';
  }
  if (/iphone|ipad|ipod/.test(ua)) {
    return isStandalone ? 'ios-webapp' : 'ios-safari';
  }
  if (/chrome/.test(ua)) return 'desktop-chrome';
  if (/safari/.test(ua)) return 'desktop-safari';
  return 'web';
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

export function getPushPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function hasPushSetupReady() {
  return Boolean(VAPID_PUBLIC_KEY);
}

export function getPushSetupMessage() {
  if (!isPushSupported()) return '이 브라우저는 웹푸시 구독을 지원하지 않습니다.';
  if (!VAPID_PUBLIC_KEY) return 'VAPID 공개키가 아직 설정되지 않았습니다.';
  return null;
}

export async function getCurrentBrowserSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeBrowserPush(): Promise<BrowserPushSubscriptionPayload> {
  if (!isPushSupported()) {
    throw new Error('이 브라우저는 웹푸시를 지원하지 않습니다.');
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID 공개키가 설정되지 않았습니다.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('알림 권한이 허용되지 않았습니다.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  return {
    endpoint: subscription.endpoint,
    p256dh: bufferToBase64Url(subscription.getKey('p256dh')),
    auth: bufferToBase64Url(subscription.getKey('auth')),
    platform: getPlatformLabel(),
    userAgent: navigator.userAgent ?? null,
    appVersion: APP_VERSION,
  };
}

export async function unsubscribeBrowserPush() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}
