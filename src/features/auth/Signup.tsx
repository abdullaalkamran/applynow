import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GraduationCap, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiGet } from "../../utils/apiClient";
import { ROLE_HOME } from "../../layouts/nav";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";

interface ReferralAgent { id: string; name: string; organization?: string }

// Same recessed field as the login page / student app.
const INPUT_CLASS = "w-full rounded-xl bg-[var(--sd-card)] px-3.5 py-3 text-[13px] text-neutral-800 shadow-neu-inset focus:outline-none";

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
    // Same layout as the login page: one raised card, the brand centred at the top, recessed fields, a solid black button.
    <div className="neu-theme flex min-h-dvh items-center justify-center bg-[var(--sd-bg)] px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-[var(--sd-card)] p-6 shadow-neu-lg sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-white shadow-neu-dark">
            <GraduationCap size={26} />
          </div>
          <h1 className="mt-3 text-[22px] font-bold tracking-tight text-neutral-900">UnifinderAi</h1>
          <p className="mt-1 text-[13px] text-neutral-500">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-3.5">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-neutral-600">Full name</label>
            <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className={INPUT_CLASS} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-neutral-600">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={INPUT_CLASS} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-neutral-600">Password</label>
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
            <label className="mb-1.5 block text-[12px] font-medium text-neutral-600">Country</label>
            <input required value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Bangladesh" className={INPUT_CLASS} />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-neutral-600">Referral code (optional)</label>
            <input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="From your agent's link or QR code"
              className={`${INPUT_CLASS} font-mono uppercase tracking-wider`}
            />
            {referralCode.trim() && referralChecked && (
              referralAgent ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-green-700">
                  <CheckCircle2 size={13} /> You'll be connected with {referralAgent.name}
                  {referralAgent.organization ? ` (${referralAgent.organization})` : ""}
                </p>
              ) : (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-amber-700">
                  <AlertCircle size={13} /> Code not recognized — you can still sign up without it
                </p>
              )
            )}
          </div>

          {error && <p className="rounded-xl bg-[#f4e4e4] px-3 py-2 text-[12.5px] font-medium text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-neutral-900 py-3 text-[13px] font-semibold text-white shadow-neu-dark transition active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-300/70" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">or</span>
          <div className="h-px flex-1 bg-neutral-300/70" />
        </div>

        <GoogleSignInButton onCredential={handleGoogle} onError={() => setError("Google sign-in failed.")} />

        <button onClick={() => navigate("/login")} className="mt-4 flex w-full items-center justify-center text-[12.5px] font-medium text-neutral-500">
          Already have an account? <span className="ml-1 font-semibold text-neutral-900">Sign in</span>
        </button>
      </div>
    </div>
  );
}
