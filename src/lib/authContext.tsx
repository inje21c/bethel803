import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';
import { updateLastLogin } from './api';

export interface UserProfile {
  id: string;
  name: string;
  role: 'leader' | 'member';
  status: 'pending' | 'active';
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  isLeader: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role, status')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as UserProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // 5초 안에 세션 확인 안 되면 강제 해제 (SW 교착 방어)
    const fallbackTimer = setTimeout(() => {
      if (mounted.current) setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearTimeout(fallbackTimer);
        if (mounted.current) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      // 모든 세션 관련 이벤트 처리
      const id = ++requestId.current;

      let profile: UserProfile | null = null;
      try {
        profile = await fetchProfile(session.user.id);
      } catch {
        // 네트워크 실패 시에도 loading 해제 (fallback timer가 살아있으므로 이중 보호)
      }

      // stale response 방지: 이 요청 이후 새 이벤트가 발화됐으면 무시
      if (id !== requestId.current || !mounted.current) return;

      clearTimeout(fallbackTimer);
      setUser(profile);
      setLoading(false);

      if (event === 'SIGNED_IN') {
        updateLastLogin(session.user.id);
      }
    });

    return () => {
      mounted.current = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // user 상태는 onAuthStateChange SIGNED_IN 이벤트에서 자동 업데이트
  }, []);

  const logout = useCallback(async () => {
    // 먼저 로컬 상태 초기화
    setUser(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // signOut 실패해도 로컬 상태는 이미 초기화됨
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('회원가입에 실패했습니다.');
    // on_auth_user_created 트리거가 public.users에 자동 insert함

    // 가입 후 로그아웃 (승인 대기 안내를 위해)
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = `${import.meta.env.VITE_APP_URL}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const profile = await fetchProfile(session.user.id);
    if (mounted.current) setUser(profile);
    return profile;
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      register,
      resetPassword,
      updatePassword,
      refreshProfile,
      isLeader: user?.role === 'leader',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth는 AuthProvider 내부에서 사용해야 합니다.');
  return context;
}
