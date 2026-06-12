/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    revision: string | null;
    url: string;
  }>;
};

// 주의: skipWaiting()을 호출하지 않는다.
// 새 버전 SW는 대기 상태로 설치만 되고, 사용자가 앱을 완전히 닫았다가
// 다시 열 때 활성화된다. (세션 중 강제 새로고침으로 입력이 끊기는 문제 방지)
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

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
