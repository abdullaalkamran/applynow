import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BookOpen, Wallet, CalendarDays, GraduationCap, ChevronRight } from "lucide-react";
import { MobileHeader, SkylineArt } from "../../components/ui/mobile";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { scholarshipAmountUSD, campusesFor } from "../../utils/universityFilter";

export default function CampusOptions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const courseName = (location.state as { courseName?: string } | null)?.courseName;
  const UNIVERSITIES = getAllUniversities();
  const university = UNIVERSITIES.find((u) => u.id === id) ?? UNIVERSITIES[0];

  if (!university) {
    return (
      <div className="px-5 py-6">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-600">
          Back
        </button>
        <p className="text-xs text-slate-400">University not found.</p>
      </div>
    );
  }

  const course = university.courses.find((c) => c.name === courseName) ?? university.courses[0];
  const campuses = campusesFor(university, course);

  return (
    <div className="pb-6">
      <div className="lg:mx-auto lg:max-w-3xl">
        <MobileHeader
          title="Campus Options"
          onBack={() => navigate(-1)}
          right={
            <button aria-label="Program details" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-600 shadow-[0_0_8px_rgba(0,0,0,0.07)]">
              <BookOpen size={16} />
            </button>
          }
        />

        <div className="px-5">
          <p className="text-[13px] leading-relaxed text-slate-500">
            {course.name} at {university.name} is available at multiple campuses. Choose a campus to see location-specific details.
          </p>

          <div className="mt-4 space-y-3">
            {campuses.map((c) => {
              const scholarshipUSD = scholarshipAmountUSD(university, c.feeUSD);
              return (
                <button
                  key={c.name}
                  className="w-full overflow-hidden rounded-2xl bg-[var(--sd-card)] text-left shadow-[0_0_10px_rgba(0,0,0,0.11)]"
                >
                  <div className="h-36 w-full">
                    {university.coverPhotoUrl ? (
                      <img src={university.coverPhotoUrl} alt={`${university.name} cover`} className="h-full w-full object-cover" />
                    ) : (
                      <SkylineArt tone={university.tone} className="h-full w-full" />
                    )}
                  </div>
                  <div className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[14.5px] font-semibold text-slate-900">{c.name}</p>
                      <ChevronRight size={16} className="shrink-0 text-slate-300" />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{c.city}, {university.country}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Wallet size={11} className="text-slate-400" /> {university.currencySymbol}
                        {Math.round(c.feeUSD).toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={11} className="text-slate-400" /> {university.openIntake}
                      </span>
                      {scholarshipUSD && (
                        <span className="inline-flex items-center gap-1">
                          <GraduationCap size={11} className="text-slate-400" /> Up to ${scholarshipUSD.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
