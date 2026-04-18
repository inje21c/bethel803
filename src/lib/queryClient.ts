import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5분: fresh 유지
      gcTime: 1000 * 60 * 15,     // 15분: stale 후에도 캐시 유지 → 재방문 시 즉시 표시 후 백그라운드 갱신
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
