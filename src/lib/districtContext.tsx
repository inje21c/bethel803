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
  homeDistrictId: string;
  homeDistrictName: string;
  currentDistrictId: string;
  currentDistrictName: string;
  isViewingOtherDistrict: boolean;
  districts: District[];
  switchDistrict: (id: string) => void;
  resetDistrict: () => void;
  refreshDistricts: () => Promise<void>;
}

const DistrictContext = createContext<DistrictContextType | null>(null);
const MASTER_DISTRICT_STORAGE_KEY = 'bethel.master.currentDistrictId';

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
      const storedDistrictId = isMaster
        ? window.localStorage.getItem(MASTER_DISTRICT_STORAGE_KEY)
        : null;
      const nextDistrictId = storedDistrictId || user.districtId;
      setCurrentDistrictId(nextDistrictId);
      setCurrentDistrictName(nextDistrictId === user.districtId ? user.districtName : '');
    }

    if (isMaster) {
      getDistricts()
        .then((loadedDistricts) => {
          setDistricts(loadedDistricts);

          const selectedDistrict = loadedDistricts.find((district) => district.id === (currentDistrictId || user.districtId));
          if (selectedDistrict) {
            setCurrentDistrictId(selectedDistrict.id);
            setCurrentDistrictName(selectedDistrict.name);
            window.localStorage.setItem(MASTER_DISTRICT_STORAGE_KEY, selectedDistrict.id);
            return;
          }

          setCurrentDistrictId(user.districtId);
          setCurrentDistrictName(user.districtName);
          window.localStorage.setItem(MASTER_DISTRICT_STORAGE_KEY, user.districtId);
        })
        .catch(() => {});
    } else {
      setDistricts([]);
    }
  }, [user, isMaster, currentDistrictId]);

  const switchDistrict = useCallback((id: string) => {
    if (!isMaster) return;
    const d = districts.find(d => d.id === id);
    if (d) {
      setCurrentDistrictId(d.id);
      setCurrentDistrictName(d.name);
      window.localStorage.setItem(MASTER_DISTRICT_STORAGE_KEY, d.id);
    }
  }, [isMaster, districts]);

  const resetDistrict = useCallback(() => {
    if (!user) return;
    setCurrentDistrictId(user.districtId);
    setCurrentDistrictName(user.districtName);
    if (isMaster) {
      window.localStorage.setItem(MASTER_DISTRICT_STORAGE_KEY, user.districtId);
    }
  }, [user, isMaster]);

  const refreshDistricts = useCallback(async () => {
    if (!isMaster) return;
    try {
      const updated = await getDistricts();
      setDistricts(updated);
    } catch { /* ignore */ }
  }, [isMaster]);

  if (!user) return <>{children}</>;

  const effectiveCurrentDistrictId = currentDistrictId || user.districtId;
  const effectiveCurrentDistrictName = currentDistrictName || user.districtName;

  return (
    <DistrictContext.Provider value={{
      homeDistrictId: user.districtId,
      homeDistrictName: user.districtName,
      currentDistrictId: effectiveCurrentDistrictId,
      currentDistrictName: effectiveCurrentDistrictName,
      isViewingOtherDistrict: isMaster && effectiveCurrentDistrictId !== user.districtId,
      districts,
      switchDistrict,
      resetDistrict,
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
