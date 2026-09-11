import { useNavigate } from "react-router-dom";
import { Settings, User, GraduationCap, Languages, Briefcase, SlidersHorizontal, Shield, ChevronRight, CheckCircle2, LogOut } from "lucide-react";
import { MobileHeader } from "../../components/ui/mobile";
import { STUDENTS, CURRENT_STUDENT_ID } from "../../data/mockData";
import { getProfileCompletion } from "../../data/profileCompletion";

const student = STUDENTS.find((s) => s.id === CURRENT_STUDENT_ID)!;
const initials = student.name.split(" ").map((n) => n[0]).slice(0, 2).join("");

const SETTINGS = [
  { icon: User, label: "Personal Information", path: "/student/profile/personal-information", stepKey: "personal-information" },
  { icon: GraduationCap, label: "Academic Details", path: "/student/profile/academic-details", stepKey: "academic-details" },
  { icon: Languages, label: "English Proficiency", path: "/student/profile/english-proficiency", stepKey: "english-proficiency" },
  { icon: Briefcase, label: "Work Experience", path: "/student/profile/work-experience", stepKey: "work-experience" },
  { icon: SlidersHorizontal, label: "Preferences", path: "/student/profile/preferences", stepKey: "preferences" },
  { icon: Shield, label: "Security", path: undefined, stepKey: undefined },
];

export default function Profile() {
  const navigate = useNavigate();
  const { percent, steps } = getProfileCompletion();
  const completeByKey = new Map(steps.map((s) => [s.key, s.complete]));

  return (
    <div className="min-h-full pb-8">
      <div className="lg:mx-auto lg:w-full lg:max-w-2xl">
        <MobileHeader title="My Profile" right={<button className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-500 shadow-sm"><Settings size={16} /></button>} />
      </div>

      <div className="px-5 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-10">
        <div className="flex flex-col items-center pb-2 pt-2 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--sd-ink)] text-xl font-semibold text-white">
            {initials}
          </div>
          <p className="mt-3 text-[16px] font-bold text-slate-900">{student.name}</p>
          <p className="text-[13px] text-slate-400">{student.email}</p>
        </div>

        <div className="mt-3 rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-700">Profile Completion</span>
            <span className="text-[13px] font-semibold text-[var(--sd-teal)]">{percent}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[var(--sd-teal)] transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.11)]">
          {SETTINGS.map((s, i) => {
            const complete = s.stepKey ? completeByKey.get(s.stepKey) : undefined;
            return (
              <button
                key={s.label}
                onClick={() => s.path && navigate(s.path)}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${i !== SETTINGS.length - 1 ? "border-b border-slate-50" : ""}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
                  <s.icon size={16} />
                </div>
                <span className="flex-1 text-[13px] font-medium text-slate-700">{s.label}</span>
                {complete && <CheckCircle2 size={15} className="text-[var(--sd-teal)]" />}
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            );
          })}
        </div>

        <button
          onClick={() => navigate("/student/onboarding")}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-[var(--sd-card)] px-4 py-3.5 text-left shadow-[0_0_10px_rgba(0,0,0,0.11)]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
            <LogOut size={16} />
          </div>
          <span className="flex-1 text-[13px] font-medium text-rose-500">Log Out</span>
        </button>
      </div>
    </div>
  );
}
