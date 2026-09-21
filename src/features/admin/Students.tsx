import { Fragment, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, KeyRound, Trash2, Save, Users, ShieldAlert, UserX, Globe2, ChevronDown, ChevronUp } from "lucide-react";
import { Badge, Button, Avatar, Modal, PageHeader, StatTile, EmptyState, FilterMenu } from "../../components/ui";
import {
  getAllStudents, createStudent, updateStudent, setStudentPassword, removeStudent,
  type StudentPatch,
} from "../../data/allStudentsStore";
import { loadStaff } from "../../data/staffStore";
import { getAllApplications } from "../../data/applicationsStore";
import { COUNTRIES } from "../../data/countries";
import { useHoldCacheSync } from "../../utils/syncCache";
import { formatStudentId } from "../../utils/displayId";
import { useIsMobile } from "../../utils/useIsMobile";
import type { Student } from "../../types";

type RiskFlag = NonNullable<Student["riskFlag"]>;

const RISK_TONE: Record<RiskFlag, "neutral" | "amber" | "red"> = { none: "neutral", watch: "amber", high: "red" };
const RISK_LABEL: Record<RiskFlag, string> = { none: "No risk", watch: "Watch", high: "High risk" };
const RISK_FILTER_LABELS = ["All", "No risk", "Watch", "High risk"] as const;
const LOGIN_FILTER_LABELS = ["All", "Has login", "No login yet"] as const;

const inputClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[var(--brand-600)] focus:outline-none";
const selectClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800";

function riskOf(s: Student): RiskFlag {
  return s.riskFlag && s.riskFlag in RISK_LABEL ? s.riskFlag : "none";
}

export default function AdminStudents() {
  const students = getAllStudents();
  const staff = loadStaff();
  const applications = getAllApplications();
  const isMobile = useIsMobile();

  // ?q= lets the admin shell's global search land here with the student already filtered.
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [countryFilter, setCountryFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState<string>("All");
  const [loginFilter, setLoginFilter] = useState<string>("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [managingId, setManagingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const agents = staff.filter((m) => m.role === "agent");
  const counsellors = staff.filter((m) => m.role === "counsellor");
  const staffName = (id?: string) => (id ? staff.find((m) => m.id === id)?.name : undefined);

  const appCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of applications) map.set(a.studentId, (map.get(a.studentId) ?? 0) + 1);
    return map;
  }, [applications]);

  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: students.length };
    for (const s of students) counts[s.country] = (counts[s.country] ?? 0) + 1;
    return counts;
  }, [students]);

  const riskCounts = useMemo(() => {
    const counts: Record<string, number> = { All: students.length, "No risk": 0, Watch: 0, "High risk": 0 };
    for (const s of students) counts[RISK_LABEL[riskOf(s)]]++;
    return counts;
  }, [students]);

  const loginCounts = useMemo(() => {
    const counts: Record<string, number> = { All: students.length, "Has login": 0, "No login yet": 0 };
    for (const s of students) counts[s.hasLogin ? "Has login" : "No login yet"]++;
    return counts;
  }, [students]);

  const ownerCounts = useMemo(() => {
    const counts: Record<string, number> = { All: students.length, Unassigned: 0 };
    for (const s of students) {
      if (!s.agentId && !s.counsellorId) counts.Unassigned++;
      for (const id of [s.agentId, s.counsellorId]) {
        const name = staffName(id);
        if (name) counts[name] = (counts[name] ?? 0) + 1;
      }
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, staff]);

  const filtered = students.filter((s) => {
    const q = query.trim().toLowerCase();
    if (q && ![s.name, s.email, s.phone ?? "", s.country, formatStudentId(s.id)].some((v) => v.toLowerCase().includes(q))) return false;
    if (countryFilter !== "All" && s.country !== countryFilter) return false;
    if (riskFilter !== "All" && RISK_LABEL[riskOf(s)] !== riskFilter) return false;
    if (loginFilter === "Has login" && !s.hasLogin) return false;
    if (loginFilter === "No login yet" && s.hasLogin) return false;
    if (ownerFilter === "Unassigned" && (s.agentId || s.counsellorId)) return false;
    if (ownerFilter !== "All" && ownerFilter !== "Unassigned" && staffName(s.agentId) !== ownerFilter && staffName(s.counsellorId) !== ownerFilter) return false;
    return true;
  });

  const highRisk = students.filter((s) => riskOf(s) === "high").length;
  const noLogin = students.filter((s) => !s.hasLogin).length;
  const countriesRepresented = new Set(students.map((s) => s.country)).size;

  function handleUpdate(id: string, patch: StudentPatch) {
    updateStudent(id, patch);
  }

  return (
    <div>
      <PageHeader
        title="Student Management"
        subtitle={isMobile ? undefined : "Every student account on the platform — edit details, assign agents and counsellors, manage logins."}
        action={
          <Button onClick={() => setAdding(true)} className="shrink-0">
            <Plus size={14} /> {isMobile ? "Add" : "Add student"}
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total students" value={String(students.length)} />
        <StatTile label="Countries" value={String(countriesRepresented)} />
        <StatTile label="High risk" value={String(highRisk)} tone={highRisk > 0 ? "red" : "neutral"} />
        <StatTile label="No login yet" value={String(noLogin)} tone={noLogin > 0 ? "amber" : "neutral"} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:max-w-sm">
          <Search size={14} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone, country, or ID…"
            className="w-full min-w-0 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <FilterMenu label="Country" icon={<Globe2 size={13} />} value={countryFilter} onChange={setCountryFilter} options={["All", ...Object.keys(countryCounts).filter((c) => c !== "All").sort()]} counts={countryCounts} />
        <FilterMenu label="Risk" icon={<ShieldAlert size={13} />} value={riskFilter} onChange={setRiskFilter} options={[...RISK_FILTER_LABELS]} counts={riskCounts} />
        <FilterMenu label="Login" icon={<KeyRound size={13} />} value={loginFilter} onChange={setLoginFilter} options={[...LOGIN_FILTER_LABELS]} counts={loginCounts} />
        <FilterMenu label="Owner" icon={<Users size={13} />} value={ownerFilter} onChange={setOwnerFilter} options={["All", "Unassigned", ...Object.keys(ownerCounts).filter((k) => k !== "All" && k !== "Unassigned").sort()]} counts={ownerCounts} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={students.length === 0 ? "No students yet" : "No students match these filters"}
          subtitle={students.length === 0 ? "Add the first student, or wait for sign-ups and agent registrations." : "Try clearing the search or a filter."}
        />
      ) : isMobile ? (
        <div className="space-y-2.5">
          {filtered.map((s) => {
            const managing = managingId === s.id;
            const risk = riskOf(s);
            return (
              <div key={s.id} className="rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.05)]">
                <button
                  onClick={() => setManagingId(managing ? null : s.id)}
                  aria-expanded={managing}
                  className="flex w-full items-start gap-3 p-4 text-left"
                >
                  <Avatar name={s.name} colorClass={s.avatarColor} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                        <p className="truncate text-xs text-slate-400">{formatStudentId(s.id)} · {s.country}</p>
                      </div>
                      {managing ? <ChevronUp size={16} className="mt-0.5 shrink-0 text-slate-400" /> : <ChevronDown size={16} className="mt-0.5 shrink-0 text-slate-400" />}
                    </div>
                    <p className="mt-1.5 truncate text-xs text-slate-600">{s.email}</p>
                    {s.phone && <p className="truncate text-xs text-slate-400">{s.phone}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {s.hasLogin ? <Badge tone="green">Active</Badge> : <Badge tone="neutral">No login yet</Badge>}
                      {risk !== "none" && <Badge tone={RISK_TONE[risk]}>{RISK_LABEL[risk]}</Badge>}
                      <Badge tone="blue">{appCount.get(s.id) ?? 0} app{(appCount.get(s.id) ?? 0) === 1 ? "" : "s"}</Badge>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                      Agent: <span className="text-slate-600">{staffName(s.agentId) ?? "—"}</span>
                      <span className="mx-1.5">·</span>
                      Counsellor: <span className="text-slate-600">{staffName(s.counsellorId) ?? "—"}</span>
                    </p>
                  </div>
                </button>
                {managing && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4">
                    <ManagePanel
                      student={s}
                      agents={agents}
                      counsellors={counsellors}
                      applicationCount={appCount.get(s.id) ?? 0}
                      onUpdate={(patch) => handleUpdate(s.id, patch)}
                      onSetPassword={(password) => setStudentPassword(s.id, password)}
                      onRemove={async () => {
                        await removeStudent(s.id);
                        setManagingId(null);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Country</th>
                <th className="px-5 py-3 font-medium">Agent</th>
                <th className="px-5 py-3 font-medium">Counsellor</th>
                <th className="px-5 py-3 font-medium">Apps</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => {
                const managing = managingId === s.id;
                const risk = riskOf(s);
                return (
                  <Fragment key={s.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} colorClass={s.avatarColor} />
                          <div>
                            <p className="font-medium text-slate-800">{s.name}</p>
                            <p className="text-xs text-slate-400">{formatStudentId(s.id)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-slate-700">{s.email}</p>
                        <p className="text-xs text-slate-400">{s.phone || "—"}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{s.country}</td>
                      <td className="px-5 py-3 text-slate-700">{staffName(s.agentId) ?? <span className="text-slate-400">—</span>}</td>
                      <td className="px-5 py-3 text-slate-700">{staffName(s.counsellorId) ?? <span className="text-slate-400">—</span>}</td>
                      <td className="px-5 py-3 text-slate-700">{appCount.get(s.id) ?? 0}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {risk !== "none" && <Badge tone={RISK_TONE[risk]}>{RISK_LABEL[risk]}</Badge>}
                          {s.hasLogin ? <Badge tone="green">Active</Badge> : <Badge tone="neutral">No login yet</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => setManagingId(managing ? null : s.id)} className="text-sm font-medium text-[var(--brand-600)]">
                          {managing ? "Close" : "Manage"}
                        </button>
                      </td>
                    </tr>
                    {managing && (
                      <tr className="bg-slate-50">
                        <td colSpan={8} className="px-5 py-4">
                          <ManagePanel
                            student={s}
                            agents={agents}
                            counsellors={counsellors}
                            applicationCount={appCount.get(s.id) ?? 0}
                            onUpdate={(patch) => handleUpdate(s.id, patch)}
                            onSetPassword={(password) => setStudentPassword(s.id, password)}
                            onRemove={async () => {
                              await removeStudent(s.id);
                              setManagingId(null);
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <AddStudentModal agents={agents} counsellors={counsellors} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}

function ManagePanel({
  student, agents, counsellors, applicationCount, onUpdate, onSetPassword, onRemove,
}: {
  student: Student;
  agents: { id: string; name: string }[];
  counsellors: { id: string; name: string }[];
  applicationCount: number;
  onUpdate: (patch: StudentPatch) => void;
  onSetPassword: (password: string) => Promise<unknown>;
  onRemove: () => Promise<void>;
}) {
  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email);
  const [phone, setPhone] = useState(student.phone ?? "");
  const [country, setCountry] = useState(student.country);
  // Held locally too: while this panel is open the cache hold above suppresses the re-render that
  // would otherwise reflect the store, so a controlled select bound straight to `student` snaps
  // back to its old value the moment it is changed.
  const [agentId, setAgentId] = useState(student.agentId ?? "");
  const [counsellorId, setCounsellorId] = useState(student.counsellorId ?? "");
  const [riskFlag, setRiskFlag] = useState<RiskFlag>(riskOf(student));
  const [settingPassword, setSettingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Keep the 12s background poll from remounting the page (and dropping half-typed edits) while
  // this panel is open — see syncCache.ts.
  useHoldCacheSync();

  // What was last saved (the `student` prop stays frozen while the cache hold is active).
  const [saved, setSaved] = useState({ name: student.name, email: student.email, phone: student.phone ?? "", country: student.country });
  const dirty = name.trim() !== saved.name || email.trim() !== saved.email || phone.trim() !== saved.phone || country !== saved.country;
  const canSave = dirty && name.trim().length > 1 && /\S+@\S+\.\S+/.test(email) && country.length > 0;

  function saveDetails() {
    setError("");
    onUpdate({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, country });
    setSaved({ name: name.trim(), email: email.trim(), phone: phone.trim(), country });
    setNotice("Details saved.");
  }

  async function submitPassword() {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSetPassword(password);
      setSettingPassword(false);
      setPassword("");
      setNotice(student.hasLogin ? "Password reset." : "Login created — the student can sign in now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set that password.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    setBusy(true);
    setError("");
    try {
      await onRemove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this student.");
      setConfirmingDelete(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="block text-xs font-medium text-slate-500">
          Full name
          <input value={name} onChange={(e) => { setName(e.target.value); setNotice(""); }} className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Email
          <input value={email} onChange={(e) => { setEmail(e.target.value); setNotice(""); }} className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Phone
          <input value={phone} onChange={(e) => { setPhone(e.target.value); setNotice(""); }} placeholder="Optional" className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Home country
          <CountrySelect value={country} onChange={(v) => { setCountry(v); setNotice(""); }} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block text-xs font-medium text-slate-500">
          Agent
          <select value={agentId} onChange={(e) => { setAgentId(e.target.value); onUpdate({ agentId: e.target.value || null }); }} className={selectClass}>
            <option value="">Unassigned</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Counsellor
          <select value={counsellorId} onChange={(e) => { setCounsellorId(e.target.value); onUpdate({ counsellorId: e.target.value || null }); }} className={selectClass}>
            <option value="">Unassigned</option>
            {counsellors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Risk flag
          <select value={riskFlag} onChange={(e) => { setRiskFlag(e.target.value as RiskFlag); onUpdate({ riskFlag: e.target.value as RiskFlag }); }} className={selectClass}>
            {(Object.keys(RISK_LABEL) as RiskFlag[]).map((r) => <option key={r} value={r}>{RISK_LABEL[r]}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={saveDetails} disabled={!canSave}><Save size={13} /> Save details</Button>
        <Button variant="secondary" onClick={() => { setSettingPassword((v) => !v); setConfirmingDelete(false); }}>
          <KeyRound size={13} /> {student.hasLogin ? "Reset password" : "Set password"}
        </Button>
        <Button variant="danger" onClick={() => { setConfirmingDelete((v) => !v); setSettingPassword(false); }}>
          <Trash2 size={13} /> Delete student
        </Button>
        {notice && <p className="text-xs text-emerald-600">{notice}</p>}
        {error && !settingPassword && !confirmingDelete && <p className="text-xs text-rose-600">{error}</p>}
      </div>

      {settingPassword && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 sm:w-auto"
          />
          <Button onClick={submitPassword} disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          {!student.hasLogin && (
            <p className="w-full text-[11px] text-slate-400">
              This student has no login yet — setting a password creates one using their email address.
            </p>
          )}
        </div>
      )}

      {confirmingDelete && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <UserX size={14} className="text-rose-600" />
          {applicationCount > 0 ? (
            <p className="text-xs text-rose-700">
              This student has {applicationCount} application{applicationCount === 1 ? "" : "s"} — withdraw or remove them before deleting the account.
            </p>
          ) : (
            <>
              <p className="text-xs text-rose-700">
                Permanently delete <span className="font-medium">{student.name}</span>, their login, documents and profile data? This can't be undone.
              </p>
              <Button variant="danger" onClick={confirmRemove} disabled={busy}>{busy ? "Deleting…" : "Yes, delete"}</Button>
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
            </>
          )}
          {error && <p className="w-full text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // A student's stored country may predate the COUNTRIES list (seeded/free-text) — keep it
  // selectable rather than silently snapping to the first option.
  const known = COUNTRIES.some((c) => c.name === value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      {!value && <option value="">Select a country</option>}
      {!known && value && <option value={value}>{value}</option>}
      {COUNTRIES.map((c) => <option key={c.iso2} value={c.name}>{c.flag} {c.name}</option>)}
    </select>
  );
}

function AddStudentModal({
  agents, counsellors, onClose,
}: {
  agents: { id: string; name: string }[];
  counsellors: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [agentId, setAgentId] = useState("");
  const [counsellorId, setCounsellorId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ name: string; email: string; password?: string } | null>(null);

  // Same reason as the student ApplyModal — a successful save must not unmount this modal before
  // its confirmation screen shows (see syncCache.ts's useHoldCacheSync).
  useHoldCacheSync();

  const canSubmit = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email) && country.length > 0 && (password.length === 0 || password.length >= 8);

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      await createStudent({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        country,
        agentId: agentId || undefined,
        counsellorId: counsellorId || undefined,
        password: password || undefined,
      });
      setCreated({ name: name.trim(), email: email.trim(), password: password || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add this student.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <Modal title="Student added" onClose={onClose}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {created.name} has been added{created.password ? " with a working login" : ""}.
          </p>
          {created.password ? (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p>Email: <span className="font-medium text-slate-800">{created.email}</span></p>
              <p className="mt-1">Temporary password: <span className="font-mono font-medium text-slate-800">{created.password}</span></p>
              <p className="mt-2 text-slate-400">Share this with them directly — it won't be shown again. They should change it once they sign in.</p>
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              No password was set, so they can't sign in yet — open Manage on their row and set a password once they're ready.
            </p>
          )}
          <Button className="w-full justify-center" onClick={onClose}>Done</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add student" onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-xs font-medium text-slate-500">
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah Khan" className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sarah.khan@email.com" className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Phone (optional)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+880 1XXX XXXXXX" className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Home country
          <CountrySelect value={country} onChange={setCountry} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-500">
            Agent
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={selectClass}>
              <option value="">Unassigned</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Counsellor
            <select value={counsellorId} onChange={(e) => setCounsellorId(e.target.value)} className={selectClass}>
              <option value="">Unassigned</option>
              {counsellors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-xs font-medium text-slate-500">
          Password (optional)
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to set up later" className={inputClass} />
        </label>
        <p className="text-[11px] text-slate-400">
          Set a password so they can sign in right away. Without one, this is just a profile with no login until a password is set later.
        </p>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <Button className="w-full justify-center" disabled={!canSubmit || submitting} onClick={handleSubmit}>
          {submitting ? "Adding…" : "Add student"}
        </Button>
      </div>
    </Modal>
  );
}
