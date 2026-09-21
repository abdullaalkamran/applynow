import { useState, type ReactNode } from "react";
import { Modal, Button, SearchableSelect } from "../../components/ui";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { createApplication } from "../../data/applicationsStore";
import { destinationOptions, campusesFor, courseHasOpenIntake } from "../../utils/universityFilter";
import { useHoldCacheSync } from "../../utils/syncCache";
import type { Student, University } from "../../types";

/** The open intake months for one course — same fallback (course's own `intakes` subset, else the
 * university's full list) courseHasOpenIntake uses, but returning the actual open months instead
 * of a boolean so the Intake dropdown can offer only those. */
function openIntakesFor(university: University, course: University["courses"][number]): string[] {
  const months = course.intakes && course.intakes.length > 0 ? course.intakes : university.intakes;
  return months.filter((m) => !!university.intakeStatus?.[m]);
}

/** The first course on a university with at least one open intake — falls back to no course
 * selected at all (empty string) rather than picking one that can't actually be applied to. */
function firstOpenCourse(university: University | undefined): University["courses"][number] | undefined {
  return university?.courses.find((c) => courseHasOpenIntake(university, c));
}

/** Shared "create an application for one of my students" flow — used both from the Applications
 * list (blank) and from the university/course browsing pages (pre-filled with the program the
 * agent was just looking at, so "Apply" doesn't force them to re-pick it from scratch). */
export function CreateApplicationModal({
  students, onClose, onCreated, initialStudentId, initialUniversityId, initialCourseName,
}: {
  students: Student[]; onClose: () => void; onCreated: () => void;
  initialStudentId?: string; initialUniversityId?: string; initialCourseName?: string;
}) {
  const UNIVERSITIES = getAllUniversities();
  const [studentId, setStudentId] = useState(initialStudentId ?? students[0]?.id ?? "");
  const initialUniversity = initialUniversityId ? UNIVERSITIES.find((u) => u.id === initialUniversityId) : undefined;
  const [country, setCountry] = useState(initialUniversity?.country ?? UNIVERSITIES[0]?.country ?? "");
  const universitiesInCountry = UNIVERSITIES.filter((u) => u.country === country);
  const [universityId, setUniversityId] = useState(initialUniversity?.id ?? universitiesInCountry[0]?.id ?? "");
  const university = UNIVERSITIES.find((u) => u.id === universityId);
  const openCourses = university?.courses.filter((c) => courseHasOpenIntake(university, c)) ?? [];
  const [courseName, setCourseName] = useState(initialCourseName ?? firstOpenCourse(university ?? initialUniversity)?.name ?? "");
  const course = university?.courses.find((c) => c.name === courseName);
  const campuses = university && course ? campusesFor(university, course) : [];
  const [campus, setCampus] = useState(campuses[0]?.name ?? "");
  const openIntakes = university && course ? openIntakesFor(university, course) : [];
  const [intake, setIntake] = useState(openIntakes[0] ?? "");
  const student = students.find((s) => s.id === studentId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Creating the application updates the applications cache, which would remount the page (and
  // unmount this modal) before onCreated/onClose could run — see syncCache.ts.
  useHoldCacheSync();
  const canSubmit = !!student && !!university && !!course && courseHasOpenIntake(university, course) && !!campus && !!intake;

  return (
    <Modal title="Create application" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Student">
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={SELECT_CLASS}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Country">
          <select
            value={country}
            onChange={(e) => {
              const v = e.target.value;
              setCountry(v);
              const inCountry = UNIVERSITIES.filter((u) => u.country === v);
              const u = inCountry[0];
              setUniversityId(u?.id ?? "");
              const c = firstOpenCourse(u);
              setCourseName(c?.name ?? "");
              setCampus((u && c ? campusesFor(u, c) : [])[0]?.name ?? "");
              setIntake((u && c ? openIntakesFor(u, c) : [])[0] ?? "");
            }}
            className={SELECT_CLASS}
          >
            {destinationOptions().map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="University">
          <select
            value={universityId}
            onChange={(e) => {
              const v = e.target.value;
              setUniversityId(v);
              const u = UNIVERSITIES.find((x) => x.id === v);
              const c = firstOpenCourse(u);
              setCourseName(c?.name ?? "");
              setCampus((u && c ? campusesFor(u, c) : [])[0]?.name ?? "");
              setIntake((u && c ? openIntakesFor(u, c) : [])[0] ?? "");
            }}
            className={SELECT_CLASS}
          >
            {universitiesInCountry.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </Field>
        {university && (
          <Field label="Subject">
            <SearchableSelect
              value={courseName}
              onChange={(v) => {
                setCourseName(v);
                const c = university.courses.find((x) => x.name === v);
                setCampus((c ? campusesFor(university, c) : [])[0]?.name ?? "");
                setIntake((c ? openIntakesFor(university, c) : [])[0] ?? "");
              }}
              options={openCourses.map((c) => c.name)}
              placeholder="Search subjects…"
            />
            {openCourses.length === 0 && (
              <p className="mt-1 text-[11px] text-rose-500">No courses at this university currently have an open intake.</p>
            )}
          </Field>
        )}
        <Field label="Campus">
          <select value={campus} onChange={(e) => setCampus(e.target.value)} className={SELECT_CLASS}>
            {campuses.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Intake">
          <select value={intake} onChange={(e) => setIntake(e.target.value)} className={SELECT_CLASS}>
            {openIntakes.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          {openIntakes.length === 0 && <p className="mt-1 text-[11px] text-rose-500">This course has no open intake right now.</p>}
        </Field>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <Button
          className="w-full justify-center"
          disabled={!canSubmit || submitting}
          onClick={async () => {
            if (!student || !university || submitting) return;
            setSubmitting(true);
            setError("");
            try {
              await createApplication({
                studentId: student.id, university: university.name, course: courseName,
                intake, country: university.country, campus,
              });
              onCreated();
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't create this application.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? "Creating…" : "Create application"}
        </Button>
      </div>
    </Modal>
  );
}

const SELECT_CLASS = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      {children}
    </label>
  );
}
