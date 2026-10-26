import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  loadStoredAuth, saveAuth, clearAuth, login as loginRequest, register as registerRequest, googleAuth, fetchMe, type AuthUser, type RegisterInput,
} from "../utils/authClient";
import { warmCaches, startCachePolling, stopCachePolling, clearAllCaches } from "../utils/warmCaches";
import { bumpSessionGeneration, AUTH_EXPIRED_EVENT } from "../utils/apiClient";
import { clearAdminToken } from "../utils/adminSettingsClient";
import { setCurrentStudentId, setCurrentAgentId } from "../data/mockData";
import { setCounsellorId } from "../utils/counsellorData";

// Per-account UI state (read notifications, seen applications, lead follow-up status, …) is now
// namespaced by user id (see utils/userScope.ts) instead of cleared on logout — clearing it is what
// made every old notification and "New" badge come back after each login. Only the legacy
// un-namespaced keys are removed here, once, so they cannot bleed between accounts.
const LEGACY_SHARED_LOCAL_KEYS = [
  "sd-shortlisted-programs",
  "sd-notifications-read",
  "sd-lead-followup-status",
  "sd-counsellor-seen-applications",
  "staff-counsellor-settings",
  "staff-custom-meetings",
  "staff-meetings-done",
];

function clearPerUserLocalState() {
  if (typeof window === "undefined") return;
  try {
    for (const key of LEGACY_SHARED_LOCAL_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable (private mode, blocked) — nothing to clear then.
  }
  clearAdminToken();
}

/** Everything that must happen between one session ending and the next beginning. */
function resetSessionState() {
  bumpSessionGeneration();
  clearAllCaches();
  clearPerUserLocalState();
}

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
  /** Starts a session from a token+user the caller already has (an agent invite's accept
   * response, same shape as `login`'s) — see AcceptInvite.tsx. */
  completeInviteLogin: (newToken: string, newUser: AuthUser) => void;
  logout: () => void;
  /** Re-reads the current user from the server (fresh, not the JWT's own claims) and updates the
   * session — call after a profile edit so the header/greeting reflect a new name/email right
   * away instead of waiting for the next login. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Points the "who am I" live bindings at this user. Also called synchronously right before
 * warmCaches() — the effect above only runs after the next render, so the very first fetches
 * (e.g. the counsellor's student list, which is keyed by their id) would otherwise go out with
 * whoever was signed in before, or nobody. */
function applyIdentity(u: AuthUser) {
  if (u.role === "student") setCurrentStudentId(u.roleUserId);
  if (u.role === "agent") setCurrentAgentId(u.roleUserId);
  if (u.role === "counsellor") setCounsellorId(u.roleUserId);
}

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
    if (user) applyIdentity(user);
  }, [user]);

  // apiClient fires this when the server rejects the stored token (expired, account deactivated
  // or removed) — end the session here so the user lands on the login page instead of a page
  // that still looks signed in while every request silently fails.
  useEffect(() => {
    function onExpired() {
      resetSessionState();
      setToken(null);
      setUser(null);
      stopCachePolling();
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    if (!initial) return;
    fetchMe(initial.token)
      .then((freshUser) => {
        setUser(freshUser);
        saveAuth(initial.token, freshUser);
        applyIdentity(freshUser);
        warmCaches();
        startCachePolling();
      })
      .catch(() => {
        clearAuth();
        resetSessionState();
        setUser(null);
        setToken(null);
      })
      .finally(() => setLoading(false));
    // Only ever run once, against whatever was in localStorage at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const { token: newToken, user: newUser } = await loginRequest(email, password);
    resetSessionState();
    saveAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    applyIdentity(newUser);
    warmCaches();
    startCachePolling();
    return newUser;
  }

  async function signup(input: RegisterInput) {
    const { token: newToken, user: newUser, agentName } = await registerRequest(input);
    resetSessionState();
    saveAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    applyIdentity(newUser);
    warmCaches();
    startCachePolling();
    return { user: newUser, agentName };
  }

  async function loginWithGoogle(credential: string, referralCode?: string) {
    const { token: newToken, user: newUser, agentName } = await googleAuth(credential, referralCode);
    resetSessionState();
    saveAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    applyIdentity(newUser);
    warmCaches();
    startCachePolling();
    return { user: newUser, agentName };
  }

  function completeInviteLogin(newToken: string, newUser: AuthUser) {
    resetSessionState();
    saveAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    applyIdentity(newUser);
    warmCaches();
    startCachePolling();
  }

  function logout() {
    clearAuth();
    stopCachePolling();
    resetSessionState();
    setToken(null);
    setUser(null);
  }

  async function refreshUser() {
    if (!token) return;
    const freshUser = await fetchMe(token);
    setUser(freshUser);
    saveAuth(token, freshUser);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, loginWithGoogle, completeInviteLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
