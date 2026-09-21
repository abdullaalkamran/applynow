import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ROLE_HOME } from "../../layouts/nav";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";

const DEMO_ACCOUNTS = [
  { email: "student@studyone.dev", label: "Student" },
  { email: "agent@studyone.dev", label: "Agent" },
  { email: "counsellor@studyone.dev", label: "Counsellor" },
  { email: "admission@studyone.dev", label: "Admission Officer" },
  { email: "compliance@studyone.dev", label: "Compliance Officer" },
  { email: "data@studyone.dev", label: "Data Management" },
  { email: "finance@studyone.dev", label: "Finance" },
  { email: "admin@studyone.dev", label: "Admin" },
];

// The seeded demo logins are a development convenience — a production build must not advertise
// real accounts and their shared password on its login page.
const SHOW_DEMO_ACCOUNTS = import.meta.env.DEV;

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      navigate(redirectTo || ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(credential: string) {
    setError("");
    setLoading(true);
    try {
      const { user } = await loginWithGoogle(credential);
      navigate(redirectTo || ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--sd-bg)] px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--sd-gradient)] text-white">
            <GraduationCap size={18} />
          </div>
          <span className="text-[17px] font-semibold text-[var(--sd-ink)]">StudyOne</span>
        </div>

        <h1 className="mt-8 text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to continue to your dashboard.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-500">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studyone.dev"
              className="w-full rounded-xl border border-slate-200 bg-[var(--sd-card)] px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--sd-ink)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-500">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-[var(--sd-card)] px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--sd-ink)]"
            />
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[image:var(--sd-gradient)] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-100" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-100" />
        </div>

        <GoogleSignInButton onCredential={handleGoogle} onError={() => setError("Google sign-in failed.")} />

        <button
          onClick={() => navigate("/signup")}
          className="mt-4 flex w-full items-center justify-center text-[12.5px] font-medium text-slate-400"
        >
          New here? <span className="ml-1 text-[var(--sd-ink)]">Create an account</span>
        </button>

        {SHOW_DEMO_ACCOUNTS && (
        <button
          onClick={() => setShowDemo((v) => !v)}
          className="mt-6 flex w-full items-center justify-center gap-1 text-[12px] font-medium text-slate-400"
        >
          Demo accounts {showDemo ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        )}

        {SHOW_DEMO_ACCOUNTS && showDemo && (
          <div className="mt-2 space-y-1 rounded-xl bg-[var(--sd-card)] p-3 text-[12px] text-slate-500">
            <p className="mb-1.5 text-slate-400">Password for every account: <span className="font-mono text-slate-600">password123</span></p>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => { setEmail(a.email); setPassword("password123"); }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-black/[0.03]"
              >
                <span className="text-slate-700">{a.label}</span>
                <span className="font-mono text-slate-400">{a.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
