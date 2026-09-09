import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { BackButton, SkylineArt, Pill } from "../../components/ui/mobile";
import { APPLICATIONS, CURRENT_STUDENT_ID, UNIVERSITIES } from "../../data/mockData";
import { applicationStatusTone } from "../../utils/applicationStatus";

export default function Applications() {
  const navigate = useNavigate();
  const applications = APPLICATIONS.filter((a) => a.studentId === CURRENT_STUDENT_ID);

  return (
    <div className="px-5 pb-6 pt-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Applications</h1>
          <p className="mt-1 text-[13px] text-slate-500">{applications.length} applications in progress</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {applications.map((app) => {
          const uni = UNIVERSITIES.find((u) => u.name === app.university);
          return (
            <button
              key={app.id}
              onClick={() => navigate(`/student/applications/${app.id}`)}
              className="w-full rounded-2xl bg-white p-4 text-left shadow-sm shadow-black/[0.03]"
            >
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                  <SkylineArt tone={uni?.tone ?? "violet"} className="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-slate-900">{app.course}</p>
                  <p className="truncate text-xs text-slate-400">{app.university}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{app.intake} Intake</p>
                </div>
                <ChevronRight size={16} className="mt-1 shrink-0 text-slate-300" />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <Pill tone={applicationStatusTone(app.status)}>{app.status}</Pill>
                <span className="text-[11px] font-medium text-slate-400">{app.progress}% complete</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[var(--sd-teal)]" style={{ width: `${app.progress}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
