import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getMyChurchSettings,
  hasModule as hasModuleFn,
  type ChurchSettings,
  type QTMode,
} from './api';
import { useAuth } from './authContext';

interface ChurchContextType {
  /** 교회 설정 + trial 정보. 미설정(prod 미적용 등) 또는 로딩 중이면 null. */
  settings: ChurchSettings | null;
  /** 최초 로드 중 여부 (캐시가 있으면 false). */
  isLoading: boolean;
  /** 설정 없음 → 'scraped' 폴백 (현행 벧엘 동작 유지). */
  qtMode: QTMode;
  /** 모듈 게이팅. 설정 로딩/일시실패 시에도 직전 캐시 기준으로 안정 판정. */
  hasModule: (module: string) => boolean;
  /** 설정 변경(관리자) 후 강제 갱신. */
  refresh: () => void;
  /** UI 복잡도 모드. simple: 핵심 기능만, full: 전체 기능 */
  uiMode: 'simple' | 'full';
  /** 마스터 탈퇴로 교회가 삭제 예정 상태(30일 유예)인지 여부 */
  isPendingDeletion: boolean;
  /** 영구 삭제 예정일 (ISO 문자열) */
  deletionDate: string | null;
}

const ChurchContext = createContext<ChurchContextType | null>(null);

/**
 * 교회 설정을 앱당 1회만 로드해 모든 페이지가 공유한다.
 * - 페이지마다 중복 호출하던 church_settings / get_my_church_info 쿼리를 단일화
 * - staleTime: Infinity + placeholderData 유지 → 윈도우 포커스 등으로 인한
 *   재조회·타임아웃이 bible_text 게이팅을 깜빡이게 하던 문제 차단
 */
export function ChurchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const enabled = !!user && user.status === 'active';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['church_settings'],
    queryFn: getMyChurchSettings,
    enabled,
    staleTime: Infinity,
    // 재조회가 일시 실패해도 직전 성공값을 버리지 않음 → 게이팅 안정화
    placeholderData: (previous) => previous,
    retry: 2,
  });

  const settings = data ?? null;

  const hasModule = useCallback(
    (module: string) => hasModuleFn(settings, module),
    [settings]
  );

  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <ChurchContext.Provider
      value={{
        settings,
        isLoading: enabled && isLoading,
        qtMode: settings?.qtMode ?? 'scraped',
        hasModule,
        refresh,
        uiMode: settings?.uiMode ?? 'full',
        isPendingDeletion: settings?.isPendingDeletion ?? false,
        deletionDate: settings?.deletionDate ?? null,
      }}
    >
      {children}
    </ChurchContext.Provider>
  );
}

export function useChurch() {
  const ctx = useContext(ChurchContext);
  if (!ctx) throw new Error('useChurch는 ChurchProvider 내부에서 사용해야 합니다.');
  return ctx;
}
