import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, Download, MoreHorizontal, Check } from "lucide-react";
import { EmptyState } from "../../components/ui";
import { getAllStudents } from "../../data/allStudentsStore";
import { getAllApplications } from "../../data/applicationsStore";
import { loadStaff } from "../../data/staffStore";
import { countryByName } from "../../data/countries";
import { formatApplicationId } from "../../utils/displayId";
import {
  dashboardAppId, daysInStage, isAtRisk, isMissingDocuments, isRecentProgress, isTerminal, journeyIndexOf,
  noOfferYet, STALE_DAYS, JOURNEY_STAGES, type DateRange, inDateRange,
} from "../../utils/adminDashboard";
import { useIsMobile } from "../../utils/useIsMobile";
import type { Application, Student } from "../../types";

export type TabKey = "risk" | "noOffer" | "missingDocs" | "recent" | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "risk", label: "Students at Risk" },
  { key: "noOffer", label: "No Offer Yet" },
  { key: "missingDocs", label: "Missing Documents" },
  { key: "recent", label: "Recent Progress" },
  { key: "all", label: "All Applications" },
];

const DAYS_OPTIONS = [
  { value: 0, label: "Any duration" },
  { value: 3, label: "> 3 days" },
  { value: STALE_DAYS, label: `> ${STALE_DAYS} days` },
  { value: 14, label: "> 14 days" },
  { value: 30, label: "> 30 days" },
];

type Tone = "rose" | "amber" | "blue" | "green" | "violet" | "slate";

const TONE_BADGE: Record<Tone, string> = {
  rose: "bg-[#fdecef] text-[#c81e4a]",
  amber: "bg-[#fdf3dc] text-[#b7791f]",
  blue: "bg-[#e8f1fd] text-[#2563eb]",
  green: "bg-[#e6f6ec] text-[#15803d]",
  violet: "bg-[#efe9fd] text-[#7c3aed]",
  slate: "bg-slate-100 text-slate-600",
};

const TONE_DOT: Record<Tone, string> = {
  rose: "bg-[#e11d48]",
  amber: "bg-[#f59e0b]",
  blue: "bg-[#2563eb]",
  green: "bg-[#15803d]",
  violet: "bg-[#7c3aed]",
  slate: "bg-slate-400",
};

/** Colour for a row — mirrors the design's semantics: red for stuck/not-submitted, amber for
 * waiting, blue for in review, green for offers/progress, violet for payment. */
function toneOf(a: Application, now: number): Tone {
  switch (a.status) {
    case "Deposit Pending": return "violet";
    case "Offer Received": case "Offer Conditions Pending": case "Deposit Paid": case "CAS/COE Issued": case "Visa Decision": case "Enrolled": return "green";
    case "University Review": case "Visa Submitted": return "blue";
    case "Compliance Hold": case "Rejected": case "Withdrawn": return "rose";
  }
  if (isMissingDocuments(a)) return "amber";
  if (journeyIndexOf(a) <= 1) return daysInStage(a, now) > STALE_DAYS ? "rose" : "amber";
  return "amber";
}

/** Short stage label for the "Current Stage" badge. */
function stageLabel(a: Application): string {
  if (journeyIndexOf(a) <= 1 && !isTerminal(a)) return a.status === "Documents Pending" ? "Missing Documents" : "Not Submitted";
  if (a.status === "University Review") return "Under Review";
  if (a.status === "Additional Documents Requested") return "Missing Documents";
  if (a.status === "Deposit Pending") return "Payment Pending";
  return a.status;
}

export interface ApplicationsTableProps {
  range?: DateRange;
  initialTab?: TabKey;
  initialQuery?: string;
  // Lets a parent (the dashboard's Top Issues list) jump this table to a tab.
  tabOverride?: { tab: TabKey; nonce: number };
}

export function ApplicationsTable({ range, initialTab = "risk", initialQuery = "", tabOverride }: ApplicationsTableProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const now = Date.now();
  const students = getAllStudents();
  const staff = loadStaff();
  const byStudent = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const staffName = (id?: string) => (id ? staff.find((m) => m.id === id)?.name : undefined);

  const scoped = useMemo(() => {
    const all = getAllApplications();
    return range ? all.filter((a) => inDateRange(a, range)) : all;
  }, [range]);

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [query, setQuery] = useState(initialQuery);
  const [country, setCountry] = useState("");
  const [university, setUniversity] = useState("");
  const [stage, setStage] = useState("");
  const [counsellor, setCounsellor] = useState("");
  const [minDays, setMinDays] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);

  useEffect(() => {
    if (tabOverride) setTab(tabOverride.tab);
  }, [tabOverride]);

  const counsellorOf = (a: Application) => a.responsibleCounsellorId ?? byStudent.get(a.studentId)?.counsellorId;

  const tabMatch = (a: Application): boolean => {
    switch (tab) {
      case "risk": return isAtRisk(a, byStudent.get(a.studentId), now);
      case "noOffer": return noOfferYet(a, now);
      case "missingDocs": return isMissingDocuments(a);
      case "recent": return isRecentProgress(a, now);
      default: return true;
    }
  };

  const tabCounts = useMemo(() => {
    const counts = {} as Record<TabKey, number>;
    for (const t of TABS) {
      counts[t.key] = scoped.filter((a) => {
        switch (t.key) {
          case "risk": return isAtRisk(a, byStudent.get(a.studentId), now);
          case "noOffer": return noOfferYet(a, now);
          case "missingDocs": return isMissingDocuments(a);
          case "recent": return isRecentProgress(a, now);
          default: return true;
        }
      }).length;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, byStudent]);

  const countries = useMemo(() => [...new Set(scoped.map((a) => a.country))].sort(), [scoped]);
  const universities = useMemo(() => [...new Set(scoped.map((a) => a.university))].sort(), [scoped]);
  const stages = JOURNEY_STAGES.map((s) => s.label);
  const counsellors = useMemo(
    () => [...new Set(scoped.map((a) => staffName(counsellorOf(a))).filter((n): n is string => !!n))].sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, staff],
  );

  const q = query.trim().toLowerCase();
  const rows = scoped.filter((a) => {
    if (!tabMatch(a)) return false;
    const student = byStudent.get(a.studentId);
    const appId = dashboardAppId(formatApplicationId(a.id), a);
    if (q && ![student?.name ?? "", appId, a.university, a.course].some((v) => v.toLowerCase().includes(q))) return false;
    if (country && a.country !== country) return false;
    if (university && a.university !== university) return false;
    if (stage && JOURNEY_STAGES[journeyIndexOf(a)]?.label !== stage) return false;
    if (counsellor && staffName(counsellorOf(a)) !== counsellor) return false;
    if (minDays && daysInStage(a, now) <= minDays) return false;
    return true;
  });

  const filtersActive = !!(q || country || university || stage || counsellor || minDays);

  function clearFilters() {
    setQuery(""); setCountry(""); setUniversity(""); setStage(""); setCounsellor(""); setMinDays(0);
  }

  const allSelected = rows.length > 0 && rows.every((a) => selected.has(a.id));
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((a) => a.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const chosen = selected.size ? rows.filter((a) => selected.has(a.id)) : rows;
    const header = ["Application ID", "Student", "Email", "University", "Course", "Country", "Status", "Days in stage", "Next action", "Counsellor", "Updated"];
    const lines = chosen.map((a) => {
      const s = byStudent.get(a.studentId);
      return [dashboardAppId(formatApplicationId(a.id), a), s?.name ?? "", s?.email ?? "", a.university, a.course, a.country, a.status, String(daysInStage(a, now)), a.nextAction, staffName(counsellorOf(a)) ?? "", a.updatedAt];
    });
    // A cell starting with = + - @ (or a tab/CR) is executed as a formula by Excel/LibreOffice —
    // and student names, courses and next actions are user-entered text — so those get a leading
    // apostrophe, which spreadsheets show as plain text.
    const safeCell = (v: unknown) => {
      const text = v == null ? "" : String(v);
      return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    };
    const csv = [header, ...lines].map((r) => r.map((v) => `"${safeCell(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `applications-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 pt-1">
        <div className="-mb-px flex min-w-0 items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = tabCounts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3.5 text-[12px] font-medium transition ${
                  active ? "border-[#0b5d3d] text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${active && t.key === "risk" ? "bg-[#fdecef] text-[#c81e4a]" : "bg-slate-100 text-slate-600"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          aria-label="Export CSV"
          className="my-2 flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:px-4"
        >
          <Download size={15} /> <span className="hidden sm:inline">Export{selected.size ? ` (${selected.size})` : ""}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5">
        <div className="flex h-9 w-full items-center gap-2 rounded-lg bg-[#f1f4f8] px-3 sm:w-[280px]">
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student..."
            className="w-full min-w-0 bg-transparent text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <Select label="Country" value={country} onChange={setCountry} options={countries} />
        <Select label="University" value={university} onChange={setUniversity} options={universities} />
        <Select label="Stage" value={stage} onChange={setStage} options={stages} />
        <Select label="Counselor" value={counsellor} onChange={setCounsellor} options={counsellors} />
        <Select
          label={DAYS_OPTIONS.find((o) => o.value === STALE_DAYS)!.label}
          value={minDays ? String(minDays) : ""}
          onChange={(v) => setMinDays(Number(v) || 0)}
          options={DAYS_OPTIONS.filter((o) => o.value).map((o) => String(o.value))}
          render={(v) => DAYS_OPTIONS.find((o) => String(o.value) === v)?.label ?? v}
          allLabel="Any duration"
        />
        <button
          onClick={clearFilters}
          disabled={!filtersActive}
          className="h-9 rounded-lg border border-slate-200 px-3.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState
            title={scoped.length === 0 ? "No applications in this period" : "Nothing matches these filters"}
            subtitle={scoped.length === 0 ? "Applications appear here as students and counsellors create them — try widening the date range." : "Try another tab or clear a filter."}
          />
        </div>
      ) : isMobile ? (
        <div className="space-y-2.5 px-4 pb-4">
          {rows.map((a) => {
            const student = byStudent.get(a.studentId);
            const tone = toneOf(a, now);
            const days = daysInStage(a, now);
            return (
              <div key={a.id} className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-[0_0_10px_rgba(0,0,0,0.04)]">
                <div className="flex items-start gap-3">
                  <StudentAvatar student={student} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{student?.name ?? "Unknown student"}</p>
                    <p className="text-[11px] text-slate-400">{dashboardAppId(formatApplicationId(a.id), a)}</p>
                  </div>
                  <span className={`shrink-0 whitespace-nowrap text-[12px] font-semibold ${days > STALE_DAYS ? "text-[#c81e4a]" : days > 3 ? "text-[#b7791f]" : "text-[#15803d]"}`}>{days}d</span>
                </div>
                <div className="mt-3 flex items-center gap-2.5">
                  <Flag country={a.country} />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-slate-800">{a.university}</p>
                    <p className="truncate text-[11px] text-slate-400">{a.course}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${TONE_BADGE[tone]}`}>{stageLabel(a)}</span>
                  {a.nextAction && <span className={`max-w-full truncate rounded-md px-2 py-0.5 text-[11px] font-medium ${TONE_BADGE[tone]}`}>{a.nextAction}</span>}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Timeline index={journeyIndexOf(a)} tone={tone} terminal={isTerminal(a)} />
                  <span className="truncate text-[11px] text-slate-500">{staffName(counsellorOf(a)) ?? "No counsellor"}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[12px]">
            <thead>
              <tr className="bg-[#f6f8fb] text-[12px] font-medium text-slate-500">
                <th className="w-12 px-5 py-2.5"><Checkbox checked={allSelected} onChange={toggleAll} label="Select all" /></th>
                <th className="px-3 py-2.5 font-medium">Student</th>
                <th className="px-3 py-2.5 font-medium">University / Course</th>
                <th className="px-3 py-2.5 font-medium">Current Stage</th>
                <th className="px-3 py-2.5 font-medium">Days in Stage</th>
                <th className="px-3 py-2.5 font-medium">Next Action</th>
                <th className="px-3 py-2.5 font-medium">Timeline</th>
                <th className="px-3 py-2.5 font-medium">Counselor</th>
                <th className="px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => {
                const student = byStudent.get(a.studentId);
                const tone = toneOf(a, now);
                const days = daysInStage(a, now);
                const idx = journeyIndexOf(a);
                return (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3"><Checkbox checked={selected.has(a.id)} onChange={() => toggleOne(a.id)} label={`Select ${student?.name ?? a.id}`} /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <StudentAvatar student={student} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{student?.name ?? "Unknown student"}</p>
                          <p className="text-[11px] text-slate-400">{dashboardAppId(formatApplicationId(a.id), a)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <Flag country={a.country} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{a.university}</p>
                          <p className="truncate text-[11px] text-slate-400">{a.course}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-medium ${TONE_BADGE[tone]}`}>{stageLabel(a)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`whitespace-nowrap font-semibold ${days > STALE_DAYS ? "text-[#c81e4a]" : days > 3 ? "text-[#b7791f]" : "text-[#15803d]"}`}>
                        {days} day{days === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {a.nextAction ? (
                        <span className={`inline-block max-w-[220px] truncate rounded-md px-2.5 py-1 text-[12px] font-medium ${TONE_BADGE[tone]}`}>{a.nextAction}</span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-3"><Timeline index={idx} tone={tone} terminal={isTerminal(a)} /></td>
                    <td className="px-3 py-3 text-slate-700">{staffName(counsellorOf(a))?.split(" ")[0] ?? <span className="text-slate-400">—</span>}</td>
                    <td className="relative px-3 py-3">
                      <button
                        onClick={() => setMenuFor(menuFor === a.id ? null : a.id)}
                        aria-label="Row actions"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                      {menuFor === a.id && (
                        <RowMenu onClose={() => setMenuFor(null)}>
                          <MenuItem onClick={() => navigate(`/admin/students?q=${encodeURIComponent(student?.name ?? "")}`)}>View student</MenuItem>
                          <MenuItem onClick={() => navigate("/messages")}>Message counsellor</MenuItem>
                          <MenuItem onClick={() => navigate("/admin/tasks")}>Create task</MenuItem>
                        </RowMenu>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Select({
  label, value, onChange, options, render, allLabel = "All",
}: { label: string; value: string; onChange: (v: string) => void; options: string[]; render?: (v: string) => string; allLabel?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);
  const shown = value ? (render ? render(value) : value) : label;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 min-w-[128px] items-center justify-between gap-3 rounded-lg border px-3 text-[12px] ${value ? "border-[#0b5d3d]/40 bg-[#eef7f2] font-medium text-[#0b5d3d]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
      >
        <span className="truncate">{shown}</span>
        <ChevronDown size={14} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-64 w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] text-slate-600 hover:bg-slate-50">
            {allLabel} {!value && <Check size={13} />}
          </button>
          {options.length === 0 && <p className="px-3 py-1.5 text-[12px] text-slate-400">No options</p>}
          {options.map((o) => (
            <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }} className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] hover:bg-slate-50 ${o === value ? "font-semibold text-[#0b5d3d]" : "text-slate-700"}`}>
              <span className="truncate">{render ? render(o) : o}</span>
              {o === value && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[#0b5d3d]"
    />
  );
}

function StudentAvatar({ student }: { student?: Student }) {
  const name = student?.name ?? "?";
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${student?.avatarColor ?? "bg-slate-400"}`}>
      {initials}
    </div>
  );
}

/** Round flag for the application's destination country — a real flag image where one is known,
 * falling back to the ISO code so it never renders as a broken image. */
function Flag({ country }: { country: string }) {
  const meta = countryByName(country) ?? countryByName(ALIASES[country] ?? "");
  const [broken, setBroken] = useState(false);
  const iso2 = meta?.iso2 ?? EXTRA_ISO[country];
  const iso = iso2?.toLowerCase();
  if (!iso || broken) {
    return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-500">{iso2 ?? country.slice(0, 2).toUpperCase()}</span>;
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${iso}.png`}
      srcSet={`https://flagcdn.com/w80/${iso}.png 2x`}
      alt={country}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
    />
  );
}

const ALIASES: Record<string, string> = { UK: "United Kingdom", USA: "United States", US: "United States", UAE: "United Arab Emirates" };

// Destination countries the (student home-country oriented) COUNTRIES list doesn't carry.
const EXTRA_ISO: Record<string, string> = {
  "New Zealand": "NZ", Malaysia: "MY", Netherlands: "NL", France: "FR", Italy: "IT", Spain: "ES", Sweden: "SE", Finland: "FI",
  Denmark: "DK", Norway: "NO", Hungary: "HU", Poland: "PL", Japan: "JP", "South Korea": "KR", Singapore: "SG", Cyprus: "CY",
  Turkey: "TR", Switzerland: "CH", Austria: "AT",
};

function Timeline({ index, tone, terminal }: { index: number; tone: Tone; terminal: boolean }) {
  return (
    <div className="flex items-center" aria-label={`Stage ${index + 1} of ${JOURNEY_STAGES.length}`}>
      {JOURNEY_STAGES.map((s, i) => {
        const done = i <= index;
        const dotTone = terminal ? "rose" : tone;
        return (
          <div key={s.key} className="flex items-center">
            <span className={`h-2.5 w-2.5 rounded-full ${done ? TONE_DOT[dotTone] : "bg-slate-200"}`} title={s.label} />
            {i < JOURNEY_STAGES.length - 1 && <span className={`h-px w-4 ${i < index ? TONE_DOT[dotTone] : "bg-slate-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function RowMenu({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute right-3 z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
      {children}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50">
      {children}
    </button>
  );
}
