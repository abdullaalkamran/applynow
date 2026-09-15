import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadStoredAuth, saveAuth, clearAuth, login as loginRequest, fetchMe, type AuthUser } from "../utils/authClient";
import { warmCaches } from "../utils/warmCaches";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = loadStoredAuth();
  const [user, setUser] = useState<AuthUser | null>(initial?.user ?? null);
  const [token, setToken] = useState<string | null>(initial?.token ?? null);
  // Only block on a network round trip when there's a stored session to actually verify —
  // an unauthenticated visitor should hit the login page instantly, not wait on a fetch first.
  const [loading, setLoading] = useState(!!initial);

  useEffect(() => {
    if (!initial) return;
    fetchMe(initial.token)
      .then((freshUser) => {
        setUser(freshUser);
        saveAuth(initial.token, freshUser);
        warmCaches();
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
    return newUser;
  }

  function logout() {
    clearAuth();
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, token, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
