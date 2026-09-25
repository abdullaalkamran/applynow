import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GraduationCap, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiGet } from "../../utils/apiClient";
import { ROLE_HOME } from "../../layouts/nav";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";

interface ReferralAgent { id: string; name: string; organization?: string }

const INPUT_CLASS = "w-full rounded-xl border border-slate-200 bg-[var(--sd-card)] px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--sd-ink)]";

export default function Signup() {
  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [referralCode, setReferralCode] = useState(searchParams.get("ref")?.toUpperCase() ?? "");
  const [referralAgent, setReferralAgent] = useState<ReferralAgent | null>(null);
  const [referralChecked, setReferralChecked] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Debounced lookup so the referring agent's name shows up as confirmation before submitting —
  // whether the code arrived pre-filled from a shared link/QR or was typed in by hand.
  useEffect(() => {
    const code = referralCode.trim();
    if (!code) {
      setReferralAgent(null);
      setReferralChecked(false);
      return;
    }
    setReferralChecked(false);
    const timer = window.setTimeout(() => {
      apiGet<ReferralAgent>(`/api/staff/referral/${encodeURIComponent(code)}`)
        .then((agent) => setReferralAgent(agent))
        .catch(() => setReferralAgent(null))
        .finally(() => setReferralChecked(true));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [referralCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        country: country.trim(),
        referralCode: referralAgent ? referralCode.trim() : undefined,
      });
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(credential: string) {
    setError("");
    setLoading(true);
    try {
      const { user } = await loginWithGoogle(credential, referralAgent ? referralCode.trim() : undefined);
      navigate(ROLE_HOME[user.role], { replace: true });
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
          <span className="text-[17px] font-semibold text-[var(--sd-ink)]">UnifinderAi</span>
        </div>

        <h1 className="mt-8 text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">Set up your student account to start your application journey.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-500">Full name</label>
            <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className={INPUT_CLASS} />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-500">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={INPUT_CLASS} />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-500">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-500">Country</label>
            <input required value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Bangladesh" className={INPUT_CLASS} />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-500">Referral code (optional)</label>
            <input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="From your agent's link or QR code"
              className={`${INPUT_CLASS} font-mono uppercase tracking-wider`}
            />
            {referralCode.trim() && referralChecked && (
              referralAgent ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
                  <CheckCircle2 size={13} /> You'll be connected with {referralAgent.name}
                  {referralAgent.organization ? ` (${referralAgent.organization})` : ""}
                </p>
              ) : (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-amber-600">
                  <AlertCircle size={13} /> Code not recognized — you can still sign up without it
                </p>
              )
            )}
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[image:var(--sd-gradient)] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-100" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-100" />
        </div>

        <GoogleSignInButton onCredential={handleGoogle} onError={() => setError("Google sign-in failed.")} />

        <button onClick={() => navigate("/login")} className="mt-4 flex w-full items-center justify-center text-[12.5px] font-medium text-slate-400">
          Already have an account? <span className="ml-1 text-[var(--sd-ink)]">Sign in</span>
        </button>
      </div>
    </div>
  );
}
