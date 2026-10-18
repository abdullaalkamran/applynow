import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PillSelect, Pagination } from "../../components/ui/mobile";
import { usePagedList } from "../../utils/usePagedList";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { loadAgentStudents } from "../../data/agentStudentsStore";
import { destinationOptions, intakeOptions, matchingCourse } from "../../utils/universityFilter";
import { useFeeBand } from "../../utils/useFeeBand";
import { ProgramRow } from "./ProgramRow";
import { CreateApplicationModal } from "./CreateApplicationModal";
import type { University } from "../../types";

type Course = University["courses"][number];

export default function AgentSubjectDetail() {
  const navigate = useNavigate();
  const { subject } = useParams();
  const location = useLocation();
  const navState = location.state as { destination?: string } | null;
  const students = loadAgentStudents();
  const [destination, setDestination] = useState(navState?.destination ?? "");
  const [intake, setIntake] = useState("");
  const [applyTarget, setApplyTarget] = useState<{ university: University; course: Course } | null>(null);

  const subjectName = subject ?? "";
  const allPrograms = getAllUniversities().filter((u) => u.subjects.includes(subjectName))
    .map((university) => ({ university, course: matchingCourse(university, subjectName) }))
    .filter((p): p is { university: University; course: Course } => !!p.course);
  // Fee bands are amounts in one chosen currency — never compared across currencies.
  const band = useFeeBand(allPrograms);
  const programs = allPrograms
    .filter(({ university, course }) => {
      if (destination && university.country !== destination) return false;
      if (intake && !university.intakes.includes(intake)) return false;
      if (!band.matches(university, course)) return false;
      return true;
    });

  const hasFilters = !!(destination || intake || band.active);
  const { page, setPage, totalPages, pageItems: pagedPrograms } = usePagedList(programs, 30, `${destination}:${intake}:${band.bandValue}`);

  return (
    <div>
      <button onClick={() => navigate("/agent/universities")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-600">
        <ArrowLeft size={14} /> Back to Universities
      </button>

      <h1 className="text-lg font-semibold text-slate-900">{subjectName}</h1>
      <p className="mt-1 text-xs text-slate-500">{programs.length} program{programs.length === 1 ? "" : "s"} across your partner universities.</p>

      <div className="my-4 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <PillSelect label="Destination" value={destination} onChange={setDestination} options={destinationOptions()} />
        <PillSelect label="Intake" value={intake} onChange={setIntake} options={intakeOptions()} />
        <PillSelect label="Fees" value={band.bandValue} options={band.bandOptions} onChange={band.onBandChange} />
        {band.showCurrency && <PillSelect label="Currency" value={band.currencyValue} options={band.currencyOptions} onChange={band.onCurrencyChange} />}
        {hasFilters && (
          <button onClick={() => { setDestination(""); setIntake(""); band.reset(); }} className="shrink-0 text-[11px] font-medium text-blue-600">
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {pagedPrograms.map(({ university, course }) => (
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
            <button onClick={() => { setDestination(""); setIntake(""); band.reset(); }} className="mt-2 text-[11px] font-medium text-blue-600">
              Reset filters
            </button>
          )}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

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
