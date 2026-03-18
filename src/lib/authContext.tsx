import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';
import { updateLastLogin } from './api';
import { queryClient } from './queryClient';
import { debugLog, startTrace } from './utils';

function withAuthTimeout<T>(promise: Promise<T>, message: string, ms = 10000): Promise<T> {
  const trace = startTrace('Auth', 'request', { timeoutMs: ms });
  const watchedPromise = promise
    .then((result) => {
      trace.success();
      return result;
    })
    .catch((error) => {
      trace.error(error);
      throw error;
    });

  return Promise.race([
    watchedPromise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new Error(message);
        trace.error(error, { timedOut: true });
        reject(error);
      }, ms);
    }),
  ]);
}

export interface UserProfile {
  id: string;
  name: string;
  role: 'master' | 'leader' | 'member';
  status: 'pending' | 'active';
  districtId: string;
  districtName: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string, districtId?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  isMaster: boolean;
  isLeader: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await withAuthTimeout(
    supabase
      .from('users')
      .select('id, name, role, status, district_id, districts(name)')
      .eq('id', userId)
      .single(),
    '사용자 정보를 불러오는 시간이 초과되었습니다.'
  );
  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    role: data.role as UserProfile['role'],
    status: data.status as UserProfile['status'],
    districtId: data.district_id,
    districtName: (data.districts as { name: string } | null)?.name ?? '',
  };
}

async function resolveSessionProfile(session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']): Promise<UserProfile | null> {
  if (!session?.user) return null;
  return fetchProfile(session.user.id);
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

    const applySession = async (
      event: string,
      session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']
    ) => {
      debugLog('Auth', 'onAuthStateChange', {
        event,
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
      });

      if (event === 'SIGNED_OUT' || !session) {
        clearTimeout(fallbackTimer);
        if (mounted.current) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const id = ++requestId.current;

      let profile: UserProfile | null = null;
      try {
        profile = await resolveSessionProfile(session);
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
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      await applySession(event, session);
    });

    void (async () => {
      try {
        const { data: { session } } = await withAuthTimeout(
          supabase.auth.getSession(),
          '초기 세션 확인이 지연되고 있습니다.'
        );
        await applySession('INITIAL_SESSION_CHECK', session);
      } catch {
        if (mounted.current) setLoading(false);
      }
    })();

    return () => {
      mounted.current = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    debugLog('Auth', 'login requested', { email });
    if (mounted.current) setLoading(true);
    const { data, error } = await withAuthTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      '로그인 요청이 지연되고 있습니다. 다시 시도해주세요.'
    );
    if (error) {
      if (mounted.current) setLoading(false);
      throw error;
    }

    const profile = await resolveSessionProfile(data.session);
    queryClient.clear();
    if (mounted.current) {
      setUser(profile);
      setLoading(false);
    }
    if (data.user) {
      updateLastLogin(data.user.id);
    }
  }, []);

  const logout = useCallback(async () => {
    debugLog('Auth', 'logout requested');
    requestId.current += 1;
    if (mounted.current) {
      setLoading(true);
      setUser(null);
    }
    queryClient.clear();
    try {
      await withAuthTimeout(
        supabase.auth.signOut(),
        '로그아웃 요청이 지연되고 있습니다. 다시 시도해주세요.'
      );
    } catch {
      // signOut 실패해도 로컬 상태는 이미 초기화됨
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, districtId?: string) => {
    debugLog('Auth', 'register requested', { email, name, districtId });
    const metaData: Record<string, string> = { name };
    if (districtId) metaData.district_id = districtId;
    const { data, error } = await withAuthTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: { data: metaData },
      }),
      '회원가입 요청이 지연되고 있습니다. 다시 시도해주세요.'
    );
    if (error) throw error;
    if (!data.user) throw new Error('회원가입에 실패했습니다.');
    // on_auth_user_created 트리거가 public.users에 자동 insert함

    // 가입 후 로그아웃 (승인 대기 안내를 위해)
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    debugLog('Auth', 'resetPassword requested', { email });
    const redirectTo = `${import.meta.env.VITE_APP_URL}/reset-password`;
    const { error } = await withAuthTimeout(
      supabase.auth.resetPasswordForEmail(email, { redirectTo }),
      '비밀번호 재설정 메일 요청이 지연되고 있습니다. 다시 시도해주세요.'
    );
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    debugLog('Auth', 'updatePassword requested', { length: password.length });
    const { error } = await withAuthTimeout(
      supabase.auth.updateUser({ password }),
      '비밀번호 변경 요청이 지연되고 있습니다. 다시 시도해주세요.'
    );
    if (error) throw error;
  }, []);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    debugLog('Auth', 'refreshProfile requested');
    const { data: { session } } = await withAuthTimeout(
      supabase.auth.getSession(),
      '세션 확인이 지연되고 있습니다. 다시 시도해주세요.'
    );
    if (!session?.user) return null;
    const profile = await fetchProfile(session.user.id);
    queryClient.clear();
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
      isMaster: user?.role === 'master',
      isLeader: user?.role === 'master' || user?.role === 'leader',
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
