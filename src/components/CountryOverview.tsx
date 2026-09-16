// The Country Detail page's persistent hero (CountryHero, shown above the tab bar on every tab)
// and its "Overview" tab content (CountryOverviewCards) — shared across student/agent/counsellor
// so the layout stays identical everywhere per the design brief, with only the hero's call-to-action
// buttons swapped in by the caller. Every content section hides itself when Data Management hasn't
// filled in that specific field yet, the same convention CountryGuideSection.tsx already uses.
import type { ReactNode } from "react";
import {
  Globe2, Users, Calendar, Wallet, Home, Briefcase, Clock, Gem, GraduationCap, Star, ExternalLink,
  ChevronRight, Trophy, BookOpen, Laptop, Wrench, HeartPulse, Palette, Scale, FlaskConical,
} from "lucide-react";
import { SkylineArt } from "./ui/mobile";
import { countryByName } from "../data/countries";
import type { CountryRecord } from "../data/countryRegistry";
import type { University } from "../types";

const SKYLINE_TONES = ["violet", "amber", "teal", "rose"] as const;
function skylineToneFor(name: string): (typeof SKYLINE_TONES)[number] {
  const seed = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return SKYLINE_TONES[seed % SKYLINE_TONES.length];
}

export function CountryHero({ country, countryDetails, actions }: { country: string; countryDetails: CountryRecord | undefined; actions?: ReactNode }) {
  const flag = countryByName(country)?.flag;
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {countryDetails?.photoUrl ? (
        <img src={countryDetails.photoUrl} alt={`${country} cover`} className="h-52 w-full object-cover" />
      ) : (
        <SkylineArt tone={skylineToneFor(country)} className="h-52 w-full" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/30 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              {flag ? <span className="text-3xl leading-none">{flag}</span> : <Globe2 size={28} className="text-white" />}
              <h1 className="text-2xl font-bold text-white sm:text-3xl">{country}</h1>
            </div>
            {countryDetails?.tagline && <p className="mt-1 text-sm font-medium text-white/90">{countryDetails.tagline}</p>}
            {countryDetails?.whyThisCountry && (
              <p className="mt-2 max-w-lg text-xs leading-relaxed text-white/80">{countryDetails.whyThisCountry}</p>
            )}
          </div>
          {countryDetails?.internationalStudentStat && (
            <div className="hidden shrink-0 items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2.5 backdrop-blur sm:flex">
              <Users size={16} className="text-white" />
              <div>
                <p className="text-sm font-bold leading-none text-white">{countryDetails.internationalStudentStat}</p>
                <p className="mt-1 text-[10px] text-white/80">International Students</p>
              </div>
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

const HIGHLIGHT_ICONS = [GraduationCap, Users, Briefcase, Clock, Gem, Star];

const SUBJECT_ICONS: { match: RegExp; icon: typeof BookOpen }[] = [
  { match: /business|management|finance|account/i, icon: Briefcase },
  { match: /computer|software|it\b|data|tech/i, icon: Laptop },
  { match: /engineer/i, icon: Wrench },
  { match: /health|medic|nursing|life science/i, icon: HeartPulse },
  { match: /art|design|humanit/i, icon: Palette },
  { match: /law|legal/i, icon: Scale },
  { match: /educat/i, icon: GraduationCap },
  { match: /science/i, icon: FlaskConical },
];
function subjectIcon(subject: string) {
  return (SUBJECT_ICONS.find((s) => s.match.test(subject)) ?? { icon: BookOpen }).icon;
}

function worldRankValue(rank: string): number {
  const match = rank.match(/\d+/);
  return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

const KEY_INFO_ROWS: { key: keyof NonNullable<CountryRecord["keyInfo"]>; label: string; icon: typeof Calendar }[] = [
  { key: "popularIntakes", label: "Popular Intakes", icon: Calendar },
  { key: "avgTuitionFeeRange", label: "Average Tuition Fees", icon: Wallet },
  { key: "costOfLivingRange", label: "Cost of Living", icon: Home },
  { key: "postStudyWorkVisa", label: "Post Study Work Visa", icon: Briefcase },
  { key: "dependentsAllowed", label: "Dependents Allowed", icon: Users },
  { key: "partTimeWork", label: "Part-time Work", icon: Clock },
  { key: "applicationProcessingTime", label: "Application Processing Time", icon: Clock },
];

export function CountryOverviewCards({
  country, countryDetails, universities, subjectCounts, onOpenUniversity, onViewAllUniversities, onViewAllSubjects,
}: {
  country: string;
  countryDetails: CountryRecord | undefined;
  universities: University[];
  subjectCounts: { subject: string; count: number }[];
  onOpenUniversity: (id: string) => void;
  onViewAllUniversities: () => void;
  onViewAllSubjects: () => void;
}) {
  const topUniversities = [...universities].sort((a, b) => worldRankValue(a.worldRank) - worldRankValue(b.worldRank)).slice(0, 5);
  const topSubjects = subjectCounts.slice(0, 8);
  const keyInfoRows = KEY_INFO_ROWS.filter((row) => countryDetails?.keyInfo?.[row.key]);

  const hasAnything =
    !!countryDetails?.whyStudyHighlights?.length || keyInfoRows.length > 0 || !!countryDetails?.usefulLinks?.length || topUniversities.length > 0;

  if (!hasAnything) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-700">Country overview not added yet</p>
        <p className="mt-1 text-xs text-slate-400">Data Management hasn't filled in this country's overview content.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {!!countryDetails?.whyStudyHighlights?.length && (
          <Card title={`Why Study in ${country}?`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {countryDetails.whyStudyHighlights.map((h, i) => {
                const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length];
                return (
                  <div key={h.id} className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-50)] text-[var(--brand-700)]">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800">{h.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{h.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {keyInfoRows.length > 0 && (
          <Card title="Key Information">
            <div className="divide-y divide-slate-100">
              {keyInfoRows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    <row.icon size={14} className="shrink-0 text-slate-400" /> {row.label}
                  </span>
                  <span className="text-right text-xs font-medium text-slate-800">{countryDetails!.keyInfo![row.key]}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {topSubjects.length > 0 && (
          <Card title="Popular Study Areas" action={<TabLink onClick={onViewAllSubjects} />}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {topSubjects.map(({ subject, count }) => {
                const Icon = subjectIcon(subject);
                return (
                  <div key={subject} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                    <Icon size={14} className="shrink-0 text-slate-500" />
                    <span className="truncate text-xs font-medium text-slate-700">{subject}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-slate-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {!!countryDetails?.usefulLinks?.length && (
          <Card title="Useful Links">
            <div className="flex flex-wrap gap-2">
              {countryDetails.usefulLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-300"
                >
                  {link.label} <ExternalLink size={11} className="text-slate-400" />
                </a>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-5">
        {topUniversities.length > 0 && (
          <Card title="Top Universities" action={<TabLink onClick={onViewAllUniversities} />}>
            <div className="space-y-1">
              {topUniversities.map((u, i) => (
                <button
                  key={u.id}
                  onClick={() => onOpenUniversity(u.id)}
                  className="flex w-full items-center gap-3 rounded-xl py-2 text-left hover:bg-slate-50"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{u.name}</p>
                    <p className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Trophy size={10} /> World Ranking {u.worldRank}
                    </p>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function TabLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-[var(--brand-600)]">
      View All <ChevronRight size={13} />
    </button>
  );
}
