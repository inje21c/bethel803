/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    revision: string | null;
    url: string;
  }>;
};

// skipWaiting()은 자동으로 호출하지 않는다. 대신 클라이언트가 안전한 시점
// (탭이 백그라운드로 전환될 때, src/lib/registerSW.ts 참고)에 SKIP_WAITING
// 메시지를 보내면 그때 활성화한다 — 입력 중 강제 새로고침 방지 + 장기 방치로
// 인한 구버전 SW 고착(흰 화면) 방지를 동시에 만족시키기 위함.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// 대형 vendor 청크(vite.config.ts globIgnores 참고)는 설치 속도를 위해
// 프리캐시 대상에서 제외하고, 대신 최초 요청 시점에 SW Cache Storage에
// 캐시한다. 브라우저 HTTP 캐시보다 축출(eviction) 가능성이 낮아
// 장기간 미접속 후 재실행 시 안전망이 된다.
registerRoute(
  ({ url }) => /\/assets\/vendor-(react|supabase|charts)-.*\.js$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'vendor-chunks-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 12,
        maxAgeSeconds: 60 * 60 * 24 * 365,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /^\/functions\//, /^\/auth\//],
  }),
);

self.addEventListener('push', (event) => {
  const fallbackTitle = '벧엘구역';
  const fallbackBody = '새 알림이 도착했습니다.';

  let payload: Record<string, unknown> = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {
      title: fallbackTitle,
      body: event.data?.text() ?? fallbackBody,
    };
  }

  const title = typeof payload.title === 'string' ? payload.title : fallbackTitle;
  const body = typeof payload.body === 'string' ? payload.body : fallbackBody;
  const url = typeof payload.url === 'string' ? payload.url : '/dashboard';
  const tag = typeof payload.tag === 'string' ? payload.tag : 'bethel-notification';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      data: {
        url,
        payload,
      },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: string } | undefined;
  const targetUrl = new URL(data?.url ?? '/dashboard', self.location.origin).toString();

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of clients) {
      if ('url' in client && client.url === targetUrl && 'focus' in client) {
        await client.focus();
        return;
      }
    }

    const firstClient = clients[0];
    if (firstClient && 'navigate' in firstClient) {
      await firstClient.navigate(targetUrl);
      await firstClient.focus();
      return;
    }

    await self.clients.openWindow(targetUrl);
  })());
});

export {};
