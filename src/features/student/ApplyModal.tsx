import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, CheckCircle2 } from "lucide-react";
import { Chip } from "../../components/ui/mobile";
import { STUDENTS, CURRENT_STUDENT_ID } from "../../data/mockData";
import { createApplication } from "../../data/applicationsStore";
import { campusesFor, courseHasOpenIntake } from "../../utils/universityFilter";
import type { University } from "../../types";

type Course = University["courses"][number];

export function ApplyModal({
  university, course, onClose,
}: {
  university: University; course: Course; onClose: () => void;
}) {
  const navigate = useNavigate();
  const [intake, setIntake] = useState("");
  const [campus, setCampus] = useState("");
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const student = STUDENTS.find((s) => s.id === CURRENT_STUDENT_ID)!;
  const campuses = campusesFor(university, course.feeUSD);
  const openIntakes = (course.intakes && course.intakes.length > 0 ? course.intakes : university.intakes).filter(
    (m) => !!university.intakeStatus?.[m]
  );
  const canApply = courseHasOpenIntake(university, course);

  async function confirm() {
    if (!intake || !campus) return;
    const application = await createApplication({
      studentId: student.id,
      university: university.name,
      course: course.name,
      intake,
      country: university.country,
      campus,
      source: "student",
    });
    setConfirmedId(application.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-[var(--sd-card)] p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:rounded-3xl"
      >
        {confirmedId ? (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E3F6EC] text-[#12805A]">
              <CheckCircle2 size={28} />
            </div>
            <h2 className="mt-4 text-[16px] font-bold text-slate-900">Application submitted</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
              {course.name} at {university.name} — {campus}, {intake} intake. Your counsellor and agent can now see this application too.
            </p>
            <div className="mt-5 flex w-full items-center gap-3">
              <button
                onClick={onClose}
                className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-[var(--sd-card)] py-3 text-[13px] font-semibold text-slate-700"
              >
                Done
              </button>
              <button
                onClick={() => navigate(`/student/applications/${confirmedId}`)}
                className="flex flex-[1.3] items-center justify-center rounded-xl bg-[image:var(--sd-gradient)] py-3 text-[13px] font-semibold text-white"
              >
                View Application
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{university.name}</p>
                <h2 className="mt-0.5 truncate text-[16px] font-bold text-slate-900">Apply to {course.name}</h2>
              </div>
              <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <X size={15} />
              </button>
            </div>

            {!canApply ? (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-800">
                Applications aren't currently open for this course — check back once its intake opens.
              </p>
            ) : (
              <>
                <p className="mt-4 text-xs font-medium text-slate-500">Select a campus</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {campuses.map((c) => (
                    <Chip key={c.name} label={c.name} selected={campus === c.name} onClick={() => setCampus(c.name)} />
                  ))}
                </div>

                <p className="mt-4 text-xs font-medium text-slate-500">Select an intake</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {openIntakes.map((i) => (
                    <Chip key={i} label={i} selected={intake === i} onClick={() => setIntake(i)} />
                  ))}
                </div>

                <button
                  onClick={confirm}
                  disabled={!intake || !campus}
                  className="mt-5 w-full rounded-xl bg-[image:var(--sd-gradient)] py-3.5 text-[13px] font-semibold text-white disabled:opacity-40"
                >
                  Confirm Application
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
