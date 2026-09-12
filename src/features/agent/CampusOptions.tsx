import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Wallet, CalendarDays, GraduationCap } from "lucide-react";
import { SkylineArt } from "../../components/ui/mobile";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { campusesFor, scholarshipAmountUSD } from "../../utils/universityFilter";

export default function AgentCampusOptions() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const navState = location.state as { courseName?: string } | null;

  const UNIVERSITIES = getAllUniversities();
  const university = UNIVERSITIES.find((u) => u.id === id) ?? UNIVERSITIES[0];
  const course = university.courses.find((c) => c.name === navState?.courseName) ?? university.courses[0];
  const campuses = course ? campusesFor(university, course.feeUSD) : [];

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-600">
        <ArrowLeft size={14} /> Back
      </button>

      <h1 className="text-lg font-semibold text-slate-900">Campus Options</h1>
      {course && (
        <p className="mt-1 text-xs text-slate-500">{course.name} at {university.name}.</p>
      )}

      <div className="mt-4 space-y-3">
        {campuses.map((c) => {
          const scholarship = course ? scholarshipAmountUSD(university, c.feeUSD) : null;
          return (
            <div key={c.name} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.05)]">
              <SkylineArt tone={university.tone} className="h-28 w-full" />
              <div className="p-4">
                <p className="text-xs font-semibold text-slate-800">{c.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400"><MapPin size={11} /> {c.city}, {university.country}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><Wallet size={11} /> ${c.feeUSD.toLocaleString()}/yr</span>
                  <span className="flex items-center gap-1"><CalendarDays size={11} /> {university.openIntake}</span>
                  {scholarship !== null && (
                    <span className="flex items-center gap-1 text-emerald-600"><GraduationCap size={11} /> Up to ${scholarship.toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
