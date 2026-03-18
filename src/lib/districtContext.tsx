import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './authContext';
import { getDistricts } from './api';

export interface District {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

interface DistrictContextType {
  currentDistrictId: string;
  currentDistrictName: string;
  districts: District[];
  switchDistrict: (id: string) => void;
  refreshDistricts: () => Promise<void>;
}

const DistrictContext = createContext<DistrictContextType | null>(null);

export function DistrictProvider({ children }: { children: ReactNode }) {
  const { user, isMaster } = useAuth();
  const [districts, setDistricts] = useState<District[]>([]);
  const [currentDistrictId, setCurrentDistrictId] = useState('');
  const [currentDistrictName, setCurrentDistrictName] = useState('');
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      prevUserIdRef.current = null;
      return;
    }

    const userChanged = prevUserIdRef.current !== user.id;
    prevUserIdRef.current = user.id;

    // 유저가 바뀔 때만 구역 리셋 (토큰 갱신으로 인한 참조 변경 시 선택 유지)
    if (userChanged) {
      setCurrentDistrictId(user.districtId);
      setCurrentDistrictName(user.districtName);
    }

    if (isMaster) {
      getDistricts().then(setDistricts).catch(() => {});
    }
  }, [user, isMaster]);

  const switchDistrict = useCallback((id: string) => {
    if (!isMaster) return;
    const d = districts.find(d => d.id === id);
    if (d) {
      setCurrentDistrictId(d.id);
      setCurrentDistrictName(d.name);
    }
  }, [isMaster, districts]);

  const refreshDistricts = useCallback(async () => {
    if (!isMaster) return;
    try {
      const updated = await getDistricts();
      setDistricts(updated);
    } catch { /* ignore */ }
  }, [isMaster]);

  if (!user) return <>{children}</>;

  return (
    <DistrictContext.Provider value={{
      currentDistrictId: currentDistrictId || user.districtId,
      currentDistrictName: currentDistrictName || user.districtName,
      districts,
      switchDistrict,
      refreshDistricts,
    }}>
      {children}
    </DistrictContext.Provider>
  );
}

export function useDistrict() {
  const context = useContext(DistrictContext);
  if (!context) throw new Error('useDistrict는 DistrictProvider 내부에서 사용해야 합니다.');
  return context;
}
