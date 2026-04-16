import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';
import { updateLastLogin } from './api';
import { queryClient } from './queryClient';
import { debugLog, startTrace } from './utils';

function withAuthTimeout<T>(promise: Promise<T>, message: string, ms = 5000): Promise<T> {
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const profileRequestCache = new Map<string, Promise<UserProfile | null>>();

class InvalidSessionError extends Error {
  constructor() {
    super('Invalid or expired auth session');
    this.name = 'InvalidSessionError';
  }
}

function isUnauthorizedAuthError(error: unknown) {
  if (!error) return false;
  const message = JSON.stringify(error).toLowerCase();
  return (
    message.includes('401')
    || message.includes('jwt')
    || message.includes('unauthorized')
    || message.includes('invalid token')
    || message.includes('auth session missing')
    || message.includes('not authenticated')
  );
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  // districts 테이블 JOIN 시도, 실패 시 기본값으로 폴백
  const { data, error } = await withAuthTimeout(
    supabase
      .from('users')
      .select('id, name, role, status, district_id, districts(name)')
      .eq('id', userId)
      .single(),
    '사용자 정보를 불러오는 시간이 초과되었습니다.'
  );
  if (!error && data) {
    return {
      id: data.id,
      name: data.name,
      role: data.role as UserProfile['role'],
      status: data.status as UserProfile['status'],
      districtId: data.district_id ?? '',
      districtName: (data.districts as { name: string } | null)?.name ?? '',
    };
  }
  if (error && isUnauthorizedAuthError(error)) {
    throw new InvalidSessionError();
  }
  // districts 미존재 등 JOIN 실패 시 기본 컬럼만으로 조회
  const { data: fallback, error: fallbackError } = await withAuthTimeout(
    supabase
      .from('users')
      .select('id, name, role, status')
      .eq('id', userId)
      .single(),
    '사용자 정보를 불러오는 시간이 초과되었습니다.'
  );
  if (fallbackError && isUnauthorizedAuthError(fallbackError)) {
    throw new InvalidSessionError();
  }
  if (fallbackError || !fallback) return null;
  return {
    id: fallback.id,
    name: fallback.name,
    role: fallback.role as UserProfile['role'],
    status: fallback.status as UserProfile['status'],
    districtId: '',
    districtName: '',
  };
}

async function resolveSessionProfile(session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']): Promise<UserProfile | null> {
  if (!session?.user) return null;
  const retryDelays = [0, 500];

  for (const delayMs of retryDelays) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    try {
      const profile = await fetchProfile(session.user.id);
      if (profile) return profile;
    } catch (error) {
      if (error instanceof InvalidSessionError) {
        throw error;
      }
      // 다음 재시도에서 다시 확인
    }
  }

  return null;
}

function resolveSessionProfileCached(
  session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']
): Promise<UserProfile | null> {
  const userId = session?.user?.id;
  if (!userId) return Promise.resolve(null);

  const cached = profileRequestCache.get(userId);
  if (cached) return cached;

  const request = resolveSessionProfile(session).finally(() => {
    profileRequestCache.delete(userId);
  });

  profileRequestCache.set(userId, request);
  return request;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const mounted = useRef(true);
  const userRef = useRef<UserProfile | null>(null);

  // userRef를 항상 최신 user와 동기화
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    mounted.current = true;

    // 세션 복구가 너무 늦을 때는 "세션이 아예 없는 경우"에만 loading을 해제한다.
    // 세션이 존재하는데 profile 조회만 늦는 상황에서 /login으로 튕기는 현상을 막는다.
    const fallbackTimer = setTimeout(() => {
      void (async () => {
        if (!mounted.current) return;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session && mounted.current) {
            setUser(null);
            setLoading(false);
          }
        } catch {
          if (mounted.current) setLoading(false);
        }
      })();
    }, 4000);

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

      // 토큰 갱신은 프로필 변경과 무관 → 기존 user 유지, 불필요한 fetch 차단
      if (event === 'TOKEN_REFRESHED' && userRef.current) {
        clearTimeout(fallbackTimer);
        setLoading(false);
        return;
      }

      const id = ++requestId.current;

      let profile: UserProfile | null = null;
      let invalidSession = false;
      try {
        profile = await resolveSessionProfileCached(session);
      } catch (error) {
        invalidSession = error instanceof InvalidSessionError;
        // 네트워크 실패 시에도 loading 해제 (fallback timer가 살아있으므로 이중 보호)
      }

      // stale response 방지: 이 요청 이후 새 이벤트가 발화됐으면 무시
      if (id !== requestId.current || !mounted.current) return;

      if (invalidSession && event !== 'SIGNED_IN') {
        clearTimeout(fallbackTimer);
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        if (mounted.current) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      clearTimeout(fallbackTimer);
      // 프로필 조회가 잠시 실패해도, 동일 사용자의 기존 상태가 있으면 유지한다.
      if (profile !== null) {
        setUser(profile);
      } else if (userRef.current?.id === session.user.id) {
        debugLog('Auth', 'profile unavailable, keeping existing user state', {
          event,
          userId: session.user.id,
        });
      } else if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION_CHECK') {
        setUser(null);
      }
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
    const { error } = await withAuthTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      '로그인 요청이 지연되고 있습니다. 다시 시도해주세요.'
    );
    if (error) {
      if (mounted.current) setLoading(false);
      throw error;
    }
    // 프로필 fetch와 navigate는 onAuthStateChange(SIGNED_IN)에서 처리
    queryClient.clear();
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
        supabase.auth.signOut({ scope: 'local' }),
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
    await supabase.auth.signOut({ scope: 'local' });
    requestId.current += 1;
    if (mounted.current) {
      setUser(null);
      setLoading(false);
    }
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
