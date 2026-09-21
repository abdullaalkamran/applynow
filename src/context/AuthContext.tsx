import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  loadStoredAuth, saveAuth, clearAuth, login as loginRequest, register as registerRequest, googleAuth, fetchMe, type AuthUser, type RegisterInput,
} from "../utils/authClient";
import { warmCaches, startCachePolling, stopCachePolling } from "../utils/warmCaches";
import { setCurrentStudentId } from "../data/mockData";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  /** Public student self-signup, optionally carrying an agent's referral code — returns the
   * connected agent's name (if any) alongside the new session, same as `login`. */
  signup: (input: RegisterInput) => Promise<{ user: AuthUser; agentName?: string }>;
  /** Sign in with an existing Google-linked account, or self-signup a new student account via
   * Google — same referral-code handling as `signup`. */
  loginWithGoogle: (credential: string, referralCode?: string) => Promise<{ user: AuthUser; agentName?: string }>;
  logout: () => void;
  /** Re-reads the current user from the server (fresh, not the JWT's own claims) and updates the
   * session — call after a profile edit so the header/greeting reflect a new name/email right
   * away instead of waiting for the next login. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = loadStoredAuth();
  const [user, setUser] = useState<AuthUser | null>(initial?.user ?? null);
  const [token, setToken] = useState<string | null>(initial?.token ?? null);
  // Only block on a network round trip when there's a stored session to actually verify —
  // an unauthenticated visitor should hit the login page instantly, not wait on a fetch first.
  const [loading, setLoading] = useState(!!initial);

  // The rest of the student app (Dashboard, Applications, Documents, ...) reads "which student am
  // I" via mockData.ts's CURRENT_STUDENT_ID rather than threading useAuth() through every one of
  // those files — see setCurrentStudentId's own doc comment for why that's a live binding, not a
  // one-time snapshot. This is the single place that keeps it in sync with whoever's actually
  // logged in, covering every path (session restore, login, signup, Google) since they all funnel
  // through this same `user` state.
  useEffect(() => {
    if (user?.role === "student") setCurrentStudentId(user.roleUserId);
  }, [user]);

  useEffect(() => {
    if (!initial) return;
    fetchMe(initial.token)
      .then((freshUser) => {
        setUser(freshUser);
        saveAuth(initial.token, freshUser);
        warmCaches();
        startCachePolling();
      })
      .catch(() => {
        clearAuth();
        setUser(null);
        setToken(null);
      })
      .finally(() => setLoading(false));
    // Only ever run once, against whatever was in localStorage at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const { token: newToken, user: newUser } = await loginRequest(email, password);
    saveAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    warmCaches();
    startCachePolling();
    return newUser;
  }

  async function signup(input: RegisterInput) {
    const { token: newToken, user: newUser, agentName } = await registerRequest(input);
    saveAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    warmCaches();
    startCachePolling();
    return { user: newUser, agentName };
  }

  async function loginWithGoogle(credential: string, referralCode?: string) {
    const { token: newToken, user: newUser, agentName } = await googleAuth(credential, referralCode);
    saveAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    warmCaches();
    startCachePolling();
    return { user: newUser, agentName };
  }

  function logout() {
    clearAuth();
    setToken(null);
    setUser(null);
    stopCachePolling();
  }

  async function refreshUser() {
    if (!token) return;
    const freshUser = await fetchMe(token);
    setUser(freshUser);
    saveAuth(token, freshUser);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
