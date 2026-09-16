// Add/Edit Country — mirrors UniversityForm.tsx's pattern (full page, sectioned cards, one Save
// button) rather than a small modal, since this now captures the full Country Guide content shown
// on every university page in that country (see countryRegistry.ts).
import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "../../../components/ui";
import {
  getCountryByName, getCountryId, updateCountryDetails,
  type RequiredDocument, type VisaCostConfig, type WhyStudyHighlight, type UsefulLink,
} from "../../../data/countryRegistry";

function blankDocument(): RequiredDocument {
  return { id: `doc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`, name: "" };
}

function blankHighlight(): WhyStudyHighlight {
  return { id: `wsh-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`, title: "", description: "" };
}

function blankLink(): UsefulLink {
  return { id: `link-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`, label: "", url: "" };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DataCountryForm() {
  const navigate = useNavigate();
  const { country: countryParam } = useParams();
  const isNew = !countryParam;
  const existing = countryParam ? getCountryByName(decodeURIComponent(countryParam)) : undefined;

  const vc = existing?.visaCostConfig;
  const [name, setName] = useState(existing?.name ?? "");
  const [whyThisCountry, setWhyThisCountry] = useState(existing?.whyThisCountry ?? "");
  const [recommendedFunds, setRecommendedFunds] = useState(existing?.recommendedFundsUSD != null ? String(existing.recommendedFundsUSD) : "");
  const [documents, setDocuments] = useState<RequiredDocument[]>(existing?.requiredDocuments ?? []);
  const [applicationProcedure, setApplicationProcedure] = useState(existing?.applicationProcedure ?? "");
  const [visaProcedure, setVisaProcedure] = useState(existing?.visaProcedure ?? "");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Country Overview page content (see CountryOverview.tsx) — the hero, "Why Study Here", "Key
  // Information", and "Useful Links" sections shown on the student/agent/counsellor Country Detail
  // page's Overview tab.
  const [photoUrl, setPhotoUrl] = useState(existing?.photoUrl ?? "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [tagline, setTagline] = useState(existing?.tagline ?? "");
  const [internationalStudentStat, setInternationalStudentStat] = useState(existing?.internationalStudentStat ?? "");
  const [highlights, setHighlights] = useState<WhyStudyHighlight[]>(existing?.whyStudyHighlights ?? []);
  const [links, setLinks] = useState<UsefulLink[]>(existing?.usefulLinks ?? []);
  const ki = existing?.keyInfo;
  const [popularIntakes, setPopularIntakes] = useState(ki?.popularIntakes ?? "");
  const [avgTuitionFeeRange, setAvgTuitionFeeRange] = useState(ki?.avgTuitionFeeRange ?? "");
  const [costOfLivingRange, setCostOfLivingRange] = useState(ki?.costOfLivingRange ?? "");
  const [postStudyWorkVisa, setPostStudyWorkVisa] = useState(ki?.postStudyWorkVisa ?? "");
  const [dependentsAllowed, setDependentsAllowed] = useState(ki?.dependentsAllowed ?? "");
  const [partTimeWork, setPartTimeWork] = useState(ki?.partTimeWork ?? "");
  const [applicationProcessingTime, setApplicationProcessingTime] = useState(ki?.applicationProcessingTime ?? "");

  // Visa & Bank Statement cost breakdown (see countryRegistry.ts's VisaCostConfig) — numbers kept
  // as strings while editing, same pattern as recommendedFunds above.
  const [casPaymentPercent, setCasPaymentPercent] = useState(vc ? String(vc.casPaymentPercent) : "");
  const [healthSurchargePerYear, setHealthSurchargePerYear] = useState(vc ? String(vc.healthSurchargePerYear) : "");
  const [visaApplicationFee, setVisaApplicationFee] = useState(vc ? String(vc.visaApplicationFee) : "");
  const [tbTestCostLocal, setTbTestCostLocal] = useState(vc ? String(vc.tbTestCostLocal) : "");
  const [airTicketCostLocal, setAirTicketCostLocal] = useState(vc ? String(vc.airTicketCostLocal) : "");
  const [tuitionDuePercent, setTuitionDuePercent] = useState(vc ? String(vc.tuitionDuePercent) : "");
  const [livingCostPerMonth, setLivingCostPerMonth] = useState(vc ? String(vc.livingCostPerMonth) : "");
  const [livingCostMonths, setLivingCostMonths] = useState(vc ? String(vc.livingCostMonths) : "");
  const [localCurrencyName, setLocalCurrencyName] = useState(vc?.localCurrencyName ?? "");
  const [foreignToLocalRate, setForeignToLocalRate] = useState(vc ? String(vc.foreignToLocalRate) : "");

  const canSubmit = name.trim().length > 0;
  const backTarget = existing ? `/staff/data/countries/${encodeURIComponent(existing.name)}` : "/staff/data";

  function updateDocument(i: number, patch: Partial<RequiredDocument>) {
    setDocuments((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function updateHighlight(i: number, patch: Partial<WhyStudyHighlight>) {
    setHighlights((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }

  function updateLink(i: number, patch: Partial<UsefulLink>) {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function handlePhotoPicked(file: File | undefined) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      setPhotoUrl(await readFileAsDataUrl(file));
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleFilePicked(i: number, file: File | undefined) {
    if (!file) return;
    const doc = documents[i];
    setUploadingId(doc.id);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateDocument(i, { sampleFileName: file.name, sampleFileDataUrl: dataUrl });
    } finally {
      setUploadingId(null);
    }
  }

  function handleSubmit() {
    const trimmedName = name.trim();

    // Only saved once the admin has actually filled this section in (using the local-currency
    // name as the signal, same as every other optional section here) — a half-filled config would
    // just compute confusing zeros on the university page.
    const visaCostConfig: VisaCostConfig | undefined = localCurrencyName.trim()
      ? {
          casPaymentPercent: Number(casPaymentPercent) || 0,
          healthSurchargePerYear: Number(healthSurchargePerYear) || 0,
          visaApplicationFee: Number(visaApplicationFee) || 0,
          tbTestCostLocal: Number(tbTestCostLocal) || 0,
          airTicketCostLocal: Number(airTicketCostLocal) || 0,
          tuitionDuePercent: Number(tuitionDuePercent) || 0,
          livingCostPerMonth: Number(livingCostPerMonth) || 0,
          livingCostMonths: Number(livingCostMonths) || 0,
          localCurrencyName: localCurrencyName.trim(),
          foreignToLocalRate: Number(foreignToLocalRate) || 1,
        }
      : undefined;

    const keyInfo = {
      popularIntakes: popularIntakes.trim() || undefined,
      avgTuitionFeeRange: avgTuitionFeeRange.trim() || undefined,
      costOfLivingRange: costOfLivingRange.trim() || undefined,
      postStudyWorkVisa: postStudyWorkVisa.trim() || undefined,
      dependentsAllowed: dependentsAllowed.trim() || undefined,
      partTimeWork: partTimeWork.trim() || undefined,
      applicationProcessingTime: applicationProcessingTime.trim() || undefined,
    };
    const hasKeyInfo = Object.values(keyInfo).some(Boolean);

    const patch = {
      name: trimmedName,
      whyThisCountry: whyThisCountry.trim() || undefined,
      recommendedFundsUSD: recommendedFunds.trim() ? Number(recommendedFunds) || undefined : undefined,
      visaCostConfig,
      requiredDocuments: documents.filter((d) => d.name.trim()),
      applicationProcedure: applicationProcedure.trim() || undefined,
      visaProcedure: visaProcedure.trim() || undefined,
      photoUrl: photoUrl || undefined,
      tagline: tagline.trim() || undefined,
      internationalStudentStat: internationalStudentStat.trim() || undefined,
      whyStudyHighlights: highlights.filter((h) => h.title.trim()),
      keyInfo: hasKeyInfo ? keyInfo : undefined,
      usefulLinks: links.filter((l) => l.label.trim() && l.url.trim()),
    };

    const id = existing ? existing.id : getCountryId(trimmedName);
    updateCountryDetails(id, patch);
    navigate(`/staff/data/countries/${encodeURIComponent(trimmedName)}`);
  }

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate(backTarget)} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
        <ArrowLeft size={14} /> {existing ? `Back to ${existing.name}` : "Back to Countries"}
      </button>

      <h1 className="mb-1 text-xl font-semibold text-slate-900">{isNew ? "Add Country" : `Edit — ${existing?.name}`}</h1>
      <p className="mb-6 text-xs text-slate-500">
        This content shows on the profile page of every university in this country — Why This Country, the Cost Calculator's
        recommended funds figure, Required Documents, Application Procedure, and Visa Procedure.
      </p>

      <div className="space-y-5">
        <Section title="Identity">
          <Field label="Country name"><Input value={name} onChange={setName} placeholder="e.g. Japan" /></Field>
        </Section>

        <Section title="Why This Country">
          <Field label="Description">
            <Textarea value={whyThisCountry} onChange={setWhyThisCountry} placeholder="What makes this country a great study destination?" rows={4} />
          </Field>
        </Section>

        <Section title="Overview Page">
          <p className="text-[11px] text-slate-400">
            The hero banner shown at the top of the country's Overview tab, above the "Why This Country" text already entered.
          </p>
          <Field label="Cover photo">
            <div className="flex items-center gap-3">
              <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {photoUrl && <img src={photoUrl} alt="Country cover preview" className="h-full w-full object-cover" />}
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-600 hover:border-slate-300">
                  <Upload size={12} />
                  {uploadingPhoto ? "Uploading…" : photoUrl ? "Replace photo" : "Upload photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoPicked(e.target.files?.[0])} />
                </label>
                {photoUrl && (
                  <button onClick={() => setPhotoUrl("")} className="text-[11px] font-medium text-rose-500">Remove photo</button>
                )}
                {!photoUrl && <p className="text-[11px] text-slate-400">Falls back to an abstract illustration until one is uploaded.</p>}
              </div>
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Tagline"><Input value={tagline} onChange={setTagline} placeholder="e.g. World-class education. Global opportunities." /></Field>
            <Field label="International students stat"><Input value={internationalStudentStat} onChange={setInternationalStudentStat} placeholder="e.g. 680,000+" /></Field>
          </div>
        </Section>

        <Section
          title="Why Study Here?"
          action={
            <button onClick={() => setHighlights((prev) => [...prev, blankHighlight()])} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]">
              <Plus size={13} /> Add highlight
            </button>
          }
        >
          {highlights.length === 0 && <p className="text-xs text-slate-400">No highlights added yet — shown as icon bullets on the Overview tab.</p>}
          <div className="space-y-3">
            {highlights.map((h, i) => (
              <div key={h.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input value={h.title} onChange={(v) => updateHighlight(i, { title: v })} placeholder="Title, e.g. Post-study work opportunities" className="min-w-[200px] flex-1" />
                  <button onClick={() => setHighlights((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove highlight" className="shrink-0 text-slate-300 hover:text-rose-500">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-2">
                  <Input value={h.description} onChange={(v) => updateHighlight(i, { description: v })} placeholder="Description, e.g. 2 years Graduate Route" className="w-full" />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Key Information">
          <p className="text-[11px] text-slate-400">Shown as a quick-facts table on the Overview tab. Leave any field blank to hide that row.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Popular intakes"><Input value={popularIntakes} onChange={setPopularIntakes} placeholder="e.g. September, January, May (limited)" /></Field>
            <Field label="Average tuition fees"><Input value={avgTuitionFeeRange} onChange={setAvgTuitionFeeRange} placeholder="e.g. £10,000 - £25,000 per year" /></Field>
            <Field label="Cost of living"><Input value={costOfLivingRange} onChange={setCostOfLivingRange} placeholder="e.g. £1,023 - £1,334 per month" /></Field>
            <Field label="Post study work visa"><Input value={postStudyWorkVisa} onChange={setPostStudyWorkVisa} placeholder="e.g. 2 years (Graduate Route)" /></Field>
            <Field label="Dependents allowed"><Input value={dependentsAllowed} onChange={setDependentsAllowed} placeholder="e.g. Yes (for most courses)" /></Field>
            <Field label="Part-time work"><Input value={partTimeWork} onChange={setPartTimeWork} placeholder="e.g. 20 hours per week" /></Field>
            <Field label="Application processing time"><Input value={applicationProcessingTime} onChange={setApplicationProcessingTime} placeholder="e.g. 3 - 6 weeks" /></Field>
          </div>
        </Section>

        <Section title="Cost Calculation">
          <Field label="Recommended available funds (USD)">
            <Input type="number" value={recommendedFunds} onChange={setRecommendedFunds} placeholder="e.g. 35000" />
          </Field>
          <p className="text-[11px] text-slate-400">
            Seeds the "Available Funds" field on the Cost Calculator shown on every university's Fees tab for this country.
          </p>
        </Section>

        <Section title="Visa & Bank Statement Costs">
          <p className="text-[11px] text-slate-400">
            The full pre-visa and proof-of-funds breakdown shown on every university's Fees tab for this country (modeled on a
            UK Student visa cost sheet). Fill in a local currency name to enable this section.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="CAS/deposit payment (% of tuition)"><Input type="number" value={casPaymentPercent} onChange={setCasPaymentPercent} placeholder="e.g. 50" /></Field>
            <Field label="Health surcharge per year (university's currency)"><Input type="number" value={healthSurchargePerYear} onChange={setHealthSurchargePerYear} placeholder="e.g. 776" /></Field>
            <Field label="Visa application fee (university's currency)"><Input type="number" value={visaApplicationFee} onChange={setVisaApplicationFee} placeholder="e.g. 524" /></Field>
            <Field label="Remaining tuition due for bank statement (%)"><Input type="number" value={tuitionDuePercent} onChange={setTuitionDuePercent} placeholder="e.g. 50" /></Field>
            <Field label="Living cost per month (university's currency)"><Input type="number" value={livingCostPerMonth} onChange={setLivingCostPerMonth} placeholder="e.g. 1136" /></Field>
            <Field label="Living cost — number of months"><Input type="number" value={livingCostMonths} onChange={setLivingCostMonths} placeholder="e.g. 9" /></Field>
            <Field label="TB test / medical cost (local currency)"><Input type="number" value={tbTestCostLocal} onChange={setTbTestCostLocal} placeholder="e.g. 5000" /></Field>
            <Field label="Air-ticket cost (local currency)"><Input type="number" value={airTicketCostLocal} onChange={setAirTicketCostLocal} placeholder="e.g. 100000" /></Field>
            <Field label="Local currency name"><Input value={localCurrencyName} onChange={setLocalCurrencyName} placeholder="e.g. BDT" /></Field>
            <Field label="Exchange rate (1 unit of university's currency → local)"><Input type="number" value={foreignToLocalRate} onChange={setForeignToLocalRate} placeholder="e.g. 165" /></Field>
          </div>
        </Section>

        <Section
          title="Required Documents"
          action={
            <button onClick={() => setDocuments((prev) => [...prev, blankDocument()])} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]">
              <Plus size={13} /> Add document
            </button>
          }
        >
          {documents.length === 0 && <p className="text-xs text-slate-400">No required documents added yet.</p>}
          <div className="space-y-3">
            {documents.map((d, i) => (
              <div key={d.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input value={d.name} onChange={(v) => updateDocument(i, { name: v })} placeholder="Document name, e.g. Bank Statement" className="min-w-[160px] flex-1" />
                  <Input value={d.description ?? ""} onChange={(v) => updateDocument(i, { description: v })} placeholder="Description (optional)" className="min-w-[160px] flex-1" />
                  <button onClick={() => setDocuments((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove document" className="shrink-0 text-slate-300 hover:text-rose-500">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-600 hover:border-slate-300">
                    <Upload size={12} />
                    {uploadingId === d.id ? "Uploading…" : "Upload sample"}
                    <input type="file" className="hidden" onChange={(e) => handleFilePicked(i, e.target.files?.[0])} />
                  </label>
                  {d.sampleFileName && <span className="truncate text-[11.5px] text-slate-500">{d.sampleFileName}</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Application Procedure">
          <Field label="Steps (one per line)">
            <Textarea value={applicationProcedure} onChange={setApplicationProcedure} placeholder={"Complete an online application\nSubmit required documents\nPay the application fee"} rows={4} />
          </Field>
        </Section>

        <Section title="Visa Procedure">
          <Field label="Steps (one per line)">
            <Textarea value={visaProcedure} onChange={setVisaProcedure} placeholder={"Receive your offer letter\nApply for a student visa\nAttend a biometrics appointment"} rows={4} />
          </Field>
        </Section>

        <Section
          title="Useful Links"
          action={
            <button onClick={() => setLinks((prev) => [...prev, blankLink()])} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]">
              <Plus size={13} /> Add link
            </button>
          }
        >
          {links.length === 0 && <p className="text-xs text-slate-400">No links added yet — shown as external-link chips on the Overview tab.</p>}
          <div className="space-y-3">
            {links.map((l, i) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2">
                <Input value={l.label} onChange={(v) => updateLink(i, { label: v })} placeholder="Label, e.g. UCAS" className="min-w-[140px] flex-1" />
                <Input value={l.url} onChange={(v) => updateLink(i, { url: v })} placeholder="https://…" className="min-w-[200px] flex-[2]" />
                <button onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove link" className="shrink-0 text-slate-300 hover:text-rose-500">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
        <Button variant="secondary" onClick={() => navigate(backTarget)}>Cancel</Button>
        <Button disabled={!canSubmit} onClick={handleSubmit}>{isNew ? "Add Country" : "Save Changes"}</Button>
      </div>
    </div>
  );
}

const BASE_INPUT_CLASS = "rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800";

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-800">{title}</p>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Input({
  value, onChange, placeholder, type = "text", className = "w-full",
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${BASE_INPUT_CLASS} ${className}`}
    />
  );
}

function Textarea({
  value, onChange, placeholder, rows = 3,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full resize-none ${BASE_INPUT_CLASS}`}
    />
  );
}
