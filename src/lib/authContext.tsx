import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';
import { updateLastLogin } from './api';
import { queryClient } from './queryClient';
import { debugLog, startTrace } from './utils';

const PROFILE_CACHE_KEY = 'bethel_profile_v1';

function loadCachedProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

function saveCachedProfile(profile: UserProfile | null) {
  try {
    if (profile) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch {
    // localStorage 접근 실패 시 무시
  }
}

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
  loginWithGoogle: () => Promise<void>;
  loginWithKakao: () => Promise<void>;
  linkGoogleAccount: () => Promise<void>;
  linkKakaoAccount: () => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string, districtId?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  isMaster: boolean;
  isLeader: boolean;
  isSuperAdmin: boolean;
  authEmail: string | null;
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
  // localStorage 캐시: 초기 렌더링 즉시 프로필 복원, loading 블록 없음
  const initialProfile = useRef(loadCachedProfile());
  const [user, setUserState] = useState<UserProfile | null>(initialProfile.current);
  const [loading, setLoading] = useState(initialProfile.current === null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(true);
  const userRef = useRef<UserProfile | null>(initialProfile.current);

  const setUser = useCallback((profile: UserProfile | null) => {
    saveCachedProfile(profile);
    userRef.current = profile;
    setUserState(profile);
  }, []);

  useEffect(() => {
    mounted.current = true;

    // 캐시가 없을 때만 의미 있는 fallback: 세션이 없으면 loading 해제
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
          setAuthEmail(null);
          setLoading(false);
        }
        return;
      }

      if (session.user.email && mounted.current) setAuthEmail(session.user.email);

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
      }

      // stale response 방지: 이 요청 이후 새 이벤트가 발화됐으면 무시
      if (id !== requestId.current || !mounted.current) return;

      if (invalidSession) {
        clearTimeout(fallbackTimer);
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        if (mounted.current) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      clearTimeout(fallbackTimer);
      if (profile !== null) {
        setUser(profile);
      } else if (userRef.current?.id === session.user.id) {
        // 프로필 조회 일시 실패 → 캐시된 상태 유지
        debugLog('Auth', 'profile unavailable, keeping existing user state', {
          event,
          userId: session.user.id,
        });
      } else {
        setUser(null);
      }
      setLoading(false);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        updateLastLogin(session.user.id);
      }
    };

    // onAuthStateChange만 사용 (INITIAL_SESSION 이벤트 자동 발화)
    // 수동 getSession() 호출 제거 → 이중 applySession race condition 제거
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      await applySession(event, session);
    });

    return () => {
      mounted.current = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    debugLog('Auth', 'login requested', { email });
    const { error, data } = await withAuthTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      '로그인 요청이 지연되고 있습니다. 다시 시도해주세요.'
    );
    if (error) {
      if (mounted.current) setLoading(false);
      throw error;
    }
    // SIGNED_IN 이벤트 발화 전에 프로필 fetch를 미리 시작 → profileRequestCache에 적재
    // onAuthStateChange(SIGNED_IN)에서 resolveSessionProfileCached 호출 시 캐시 히트로 즉시 반환
    if (data.session) {
      resolveSessionProfileCached(data.session);
    }
    queryClient.clear();
  }, []);

  const loginWithProvider = useCallback(async (provider: 'google' | 'kakao') => {
    debugLog('Auth', 'loginWithProvider requested', { provider });
    const redirectTo = import.meta.env.VITE_APP_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) throw error;
    // 이후 흐름은 provider 페이지로 리다이렉트 → 복귀 시 onAuthStateChange(SIGNED_IN)에서 처리
  }, []);

  const linkProviderAccount = useCallback(async (provider: 'google' | 'kakao') => {
    debugLog('Auth', 'linkProviderAccount requested', { provider });
    const redirectTo = `${import.meta.env.VITE_APP_URL || window.location.origin}/profile`;
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo },
    });
    if (error) throw error;
  }, []);

  const loginWithGoogle = useCallback(() => loginWithProvider('google'), [loginWithProvider]);
  const loginWithKakao = useCallback(() => loginWithProvider('kakao'), [loginWithProvider]);
  const linkGoogleAccount = useCallback(() => linkProviderAccount('google'), [linkProviderAccount]);
  const linkKakaoAccount = useCallback(() => linkProviderAccount('kakao'), [linkProviderAccount]);

  const logout = useCallback(async () => {
    debugLog('Auth', 'logout requested');
    requestId.current += 1;
    if (mounted.current) setUser(null);
    queryClient.clear();
    try {
      await withAuthTimeout(
        supabase.auth.signOut({ scope: 'local' }),
        '로그아웃 요청이 지연되고 있습니다. 다시 시도해주세요.'
      );
    } catch {
      // signOut 실패해도 로컬 상태는 이미 초기화됨
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
    const redirectTo = `${import.meta.env.VITE_APP_URL || window.location.origin}/reset-password`;
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
      loginWithGoogle,
      loginWithKakao,
      linkGoogleAccount,
      linkKakaoAccount,
      logout,
      register,
      resetPassword,
      updatePassword,
      refreshProfile,
      isMaster: user?.role === 'master',
      isLeader: user?.role === 'master' || user?.role === 'leader',
      isSuperAdmin: authEmail === 'cmhyun@gmail.com',
      authEmail,
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
