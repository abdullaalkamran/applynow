import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import { Chip } from "../../components/ui/mobile";
import { CURRENT_STUDENT_ID } from "../../data/mockData";
import { createApplication, getAllApplications } from "../../data/applicationsStore";
import { campusesFor, courseHasOpenIntake } from "../../utils/universityFilter";
import { buildCoreChecklist } from "../../utils/documentChecklist";
import { getProfileCompletion } from "../../data/profileCompletion";
import { useHoldCacheSync } from "../../utils/syncCache";
import type { University } from "../../types";

type Course = University["courses"][number];

export function ApplyModal({
  university, course, onClose,
}: {
  university: University; course: Course; onClose: () => void;
}) {
  const navigate = useNavigate();
  // Without this, createApplication()'s own cache notification remounts the page underneath and
  // unmounts this modal before the "Application submitted" screen ever renders.
  useHoldCacheSync();
  const [intake, setIntake] = useState("");
  const [campus, setCampus] = useState("");
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // The session already says who the student is — no need to wait for (or crash on) the
  // student-list cache, which may not have loaded yet when this modal opens.
  const student = { id: CURRENT_STUDENT_ID };
  const profileCompletion = getProfileCompletion(student.id);
  const profileIncomplete = profileCompletion.requiredRemaining > 0;
  const nextProfileStep = profileCompletion.pendingSteps.find((s) => s.required) ?? profileCompletion.pendingSteps[0];
  const campuses = campusesFor(university, course);
  const missingCoreDocs = buildCoreChecklist(student.id).filter((row) => !row.own);
  const openIntakes = (course.intakes && course.intakes.length > 0 ? course.intakes : university.intakes).filter(
    (m) => !!university.intakeStatus?.[m]
  );
  const canApply = courseHasOpenIntake(university, course);
  // A withdrawn/rejected application doesn't count as "already applied" — everything else
  // (including a fresh Draft) does. Mirrors the server's own guard in POST /api/applications.
  const alreadyApplied = getAllApplications().some(
    (a) =>
      a.studentId === student.id &&
      a.university === university.name &&
      a.course === course.name &&
      a.status !== "Withdrawn" &&
      a.status !== "Rejected"
  );

  async function confirm() {
    if (!intake || !campus || missingCoreDocs.length > 0 || submitting) return;
    setError("");
    setSubmitting(true);
    try {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit this application.");
    } finally {
      setSubmitting(false);
    }
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

            {profileIncomplete ? (
              <div className="mt-4 rounded-xl bg-rose-50 p-3 text-[13px] text-rose-800">
                <p>
                  Complete your profile before applying — {profileCompletion.requiredRemaining} required step
                  {profileCompletion.requiredRemaining > 1 ? "s" : ""} left.
                </p>
                <button
                  type="button"
                  onClick={() => { onClose(); navigate(nextProfileStep.path); }}
                  className="mt-2 font-semibold underline underline-offset-2"
                >
                  Complete Profile
                </button>
              </div>
            ) : alreadyApplied ? (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-800">
                You've already applied to {course.name} at {university.name}. Check your{" "}
                <button
                  type="button"
                  onClick={() => navigate("/student/applications")}
                  className="font-semibold underline underline-offset-2"
                >
                  applications
                </button>{" "}
                for its status.
              </p>
            ) : !canApply ? (
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

                {missingCoreDocs.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-700" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-semibold text-amber-900">Core documents required before submitting</p>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-amber-800">
                          Upload {missingCoreDocs.slice(0, 2).map((row) => row.type).join(", ")}
                          {missingCoreDocs.length > 2 ? ` and ${missingCoreDocs.length - 2} more` : ""}.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate("/student/documents")}
                      className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-amber-900"
                    >
                      Go to Documents <ChevronRight size={13} />
                    </button>
                  </div>
                )}

                {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}

                <button
                  onClick={confirm}
                  disabled={!intake || !campus || missingCoreDocs.length > 0 || submitting}
                  className="mt-5 w-full rounded-xl bg-[image:var(--sd-gradient)] py-3.5 text-[13px] font-semibold text-white disabled:opacity-40"
                >
                  {submitting ? "Submitting…" : "Confirm Application"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
