import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ROLE_HOME } from "../../layouts/nav";
import { getAgentInvite, acceptAgentInvite, type AgentInviteSummary } from "../../data/agentInvitesStore";

type LoadState = "loading" | "ready" | "invalid";

/** Where an agent invite link (see UsersRoles.tsx's "+ Invite agent") lands — the one role with no
 * admin-direct account creation, so this is a genuine self-service signup rather than a login. */
export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { completeInviteLogin } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>("loading");
  const [invite, setInvite] = useState<AgentInviteSummary | null>(null);
  const [loadError, setLoadError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    getAgentInvite(token)
      .then((summary) => {
        setInvite(summary);
        setState("ready");
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "This invite link isn't valid.");
        setState("invalid");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitError("");
    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const { token: newToken, user } = await acceptAgentInvite(token, password);
      completeInviteLogin(newToken, user);
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't set up your account.");
    } finally {
      setSubmitting(false);
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

        {state === "loading" && <p className="mt-8 text-sm text-slate-500">Checking your invite…</p>}

        {state === "invalid" && (
          <>
            <h1 className="mt-8 text-2xl font-bold text-slate-900">This link isn't valid</h1>
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{loadError}</p>
            <p className="mt-3 text-sm text-slate-500">Ask whoever invited you to send a fresh link.</p>
          </>
        )}

        {state === "ready" && invite && (
          <>
            <h1 className="mt-8 text-2xl font-bold text-slate-900">Set up your account</h1>
            <p className="mt-1 text-sm text-slate-500">
              You've been invited as an agent{invite.organization ? ` for ${invite.organization}` : ""}. Choose a password to finish creating your account.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-500">Name</label>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">{invite.name}</p>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-500">Email</label>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">{invite.email}</p>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-500">Password</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-[var(--sd-card)] px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--sd-ink)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-500">Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-[var(--sd-card)] px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--sd-ink)]"
                />
              </div>

              {submitError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{submitError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[image:var(--sd-gradient)] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "Setting up…" : "Create account"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
