import { Award, FileText, Globe2 } from "lucide-react";
import { UNIVERSITIES } from "../../../data/mockData";
import { BackButton } from "../../../components/ui";

const GUIDES = [
  {
    title: "Document checklist basics",
    body: "Every student needs Passport, CV, English proficiency proof, and academic transcripts/certificates for each level of education (SSC through Master's) before any university-specific requirement even applies.",
  },
  {
    title: "Visa readiness",
    body: "Financial proof requirements are set by the destination country, not the university — check the country's visa rules directly rather than assuming the admissions checklist covers it.",
  },
  {
    title: "Writing a strong SOP",
    body: "A good Statement of Purpose opens with a specific moment that sparked interest, ties it to concrete coursework, explains program fit, and closes with a post-graduation goal — under 800 words.",
  },
  {
    title: "Handling a compliance hold",
    body: "Don't speculate with the student about the reason. Confirm the specific flagged document with Compliance first, then give the student one clear, concrete next step.",
  },
];

export default function CounsellorResources() {
  const scholarshipUniversities = UNIVERSITIES.filter((u) => u.scholarshipsAvailable);

  return (
    <div>
      <BackButton fallback="/staff/counsellor" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Resources</h1>
        <p className="mt-1 text-sm text-slate-500">Reference guidance and a live scholarship directory.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <FileText size={15} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-800">Counselling Guides</p>
          </div>
          <div className="divide-y divide-slate-50">
            {GUIDES.map((g) => (
              <div key={g.title} className="px-5 py-4">
                <p className="text-sm font-medium text-slate-800">{g.title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{g.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <Award size={15} className="text-amber-500" />
            <p className="text-sm font-semibold text-slate-800">Scholarship Directory ({scholarshipUniversities.length})</p>
          </div>
          <div className="divide-y divide-slate-50">
            {scholarshipUniversities.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{u.name}</p>
                  <p className="truncate text-xs text-slate-400 inline-flex items-center gap-1">
                    <Globe2 size={11} /> {u.country}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-slate-500">{u.worldRank}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
