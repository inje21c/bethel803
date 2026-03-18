import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
}

const DistrictContext = createContext<DistrictContextType | null>(null);

export function DistrictProvider({ children }: { children: ReactNode }) {
  const { user, isMaster } = useAuth();
  const [districts, setDistricts] = useState<District[]>([]);
  const [currentDistrictId, setCurrentDistrictId] = useState('');
  const [currentDistrictName, setCurrentDistrictName] = useState('');

  useEffect(() => {
    if (!user) return;

    setCurrentDistrictId(user.districtId);
    setCurrentDistrictName(user.districtName);

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

  if (!user) return <>{children}</>;

  return (
    <DistrictContext.Provider value={{
      currentDistrictId: currentDistrictId || user.districtId,
      currentDistrictName: currentDistrictName || user.districtName,
      districts,
      switchDistrict,
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
