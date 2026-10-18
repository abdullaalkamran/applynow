// Cost Planner (Quick Actions → Cost Calculator): pick a country and university, then the same calculator
// the university's Fees tab uses — selected course fee, deposit, UKVI health surcharge and the fees warning.
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { MobileHeader } from "../../components/ui/mobile";
import { NeuSelect } from "../../components/ui/NeuSelect";
import { FeesPlanner } from "../../components/FeesPlanner";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { getCountryByName } from "../../data/countryRegistry";

export default function CostPlanner() {
  const universities = getAllUniversities();
  const preset = (useLocation().state as { universityId?: string } | null)?.universityId;
  const presetUni = universities.find((u) => u.id === preset);

  const countries = useMemo(() => [...new Set(universities.map((u) => u.country))].sort(), [universities]);
  const [country, setCountry] = useState(presetUni?.country ?? "");
  const [universityId, setUniversityId] = useState(presetUni?.id ?? "");

  const inCountry = useMemo(() => universities.filter((u) => !country || u.country === country).sort((a, b) => a.name.localeCompare(b.name)), [universities, country]);
  const university = universities.find((u) => u.id === universityId);

  return (
    <div className="min-h-full pb-8">
      <MobileHeader title="Cost Calculator" />
      <div className="space-y-3 px-5">
        <NeuSelect value={country} onChange={(e) => { setCountry(e.target.value); setUniversityId(""); }} searchable aria-label="Country">
          <option value="">All countries</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </NeuSelect>
        <NeuSelect value={universityId} onChange={(e) => setUniversityId(e.target.value)} searchable aria-label="University">
          <option value="">Select a university</option>
          {inCountry.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </NeuSelect>

        {university ? (
          <FeesPlanner key={university.id} university={university} country={getCountryByName(university.country)} />
        ) : (
          <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-neu">
            <p className="text-sm font-medium text-neutral-700">Choose a university to estimate your costs</p>
            <p className="mt-1 text-xs text-neutral-400">Then pick a course — tuition, deposit and visa costs are worked out for it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
