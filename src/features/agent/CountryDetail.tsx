// Mirrors SubjectDetail.tsx (agent) — country is the fixed dimension instead of subject, and the
// "Destination" pill is dropped since it would just re-filter down to the same one country.
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PillSelect } from "../../components/ui/mobile";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { loadAgentStudents } from "../../data/agentStudentsStore";
import { subjectOptions, intakeOptions, FEE_BANDS, feeBandMax } from "../../utils/universityFilter";
import { ProgramRow } from "./ProgramRow";
import { CreateApplicationModal } from "./CreateApplicationModal";
import type { University } from "../../types";

type Course = University["courses"][number];

export default function AgentCountryDetail() {
  const navigate = useNavigate();
  const { country: countryParam } = useParams();
  const students = loadAgentStudents();
  const [subject, setSubject] = useState("");
  const [intake, setIntake] = useState("");
  const [feeBand, setFeeBand] = useState("");
  const [applyTarget, setApplyTarget] = useState<{ university: University; course: Course } | null>(null);

  const country = countryParam ? decodeURIComponent(countryParam) : "";
  const universities = getAllUniversities().filter((u) => u.country === country);
  const programs = universities
    .flatMap((university) => university.courses.map((course) => ({ university, course })))
    .filter(({ university, course }) => {
      if (subject && course.subject !== subject) return false;
      if (intake && !university.intakes.includes(intake)) return false;
      if (feeBand && course.feeUSD > feeBandMax(feeBand)) return false;
      return true;
    });

  const hasFilters = !!(subject || intake || feeBand);

  return (
    <div>
      <button onClick={() => navigate("/agent/universities")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-600">
        <ArrowLeft size={14} /> Back to Universities
      </button>

      <h1 className="text-lg font-semibold text-slate-900">{country}</h1>
      <p className="mt-1 text-xs text-slate-500">
        {universities.length} universit{universities.length === 1 ? "y" : "ies"} · {programs.length} program{programs.length === 1 ? "" : "s"}
      </p>

      <div className="my-4 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <PillSelect label="Subject" value={subject} onChange={setSubject} options={subjectOptions()} />
        <PillSelect label="Intake" value={intake} onChange={setIntake} options={intakeOptions()} />
        <PillSelect label="Fees" value={feeBand} onChange={setFeeBand} options={[...FEE_BANDS]} />
        {hasFilters && (
          <button onClick={() => { setSubject(""); setIntake(""); setFeeBand(""); }} className="shrink-0 text-[11px] font-medium text-blue-600">
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {programs.map(({ university, course }) => (
          <ProgramRow
            key={`${university.id}-${course.name}`}
            university={university}
            course={course}
            students={students}
            onApply={(u, c) => setApplyTarget({ university: u, course: c })}
          />
        ))}
      </div>
      {programs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-xs text-slate-400">No programs match this view.</p>
          {hasFilters && (
            <button onClick={() => { setSubject(""); setIntake(""); setFeeBand(""); }} className="mt-2 text-[11px] font-medium text-blue-600">
              Reset filters
            </button>
          )}
        </div>
      )}

      {applyTarget && (
        <CreateApplicationModal
          students={students}
          initialUniversityId={applyTarget.university.id}
          initialCourseName={applyTarget.course.name}
          onClose={() => setApplyTarget(null)}
          onCreated={() => setApplyTarget(null)}
        />
      )}
    </div>
  );
}
