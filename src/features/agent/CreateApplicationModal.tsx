import { useState, type ReactNode } from "react";
import { Modal, Button, SearchableSelect } from "../../components/ui";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { createApplication } from "../../data/applicationsStore";
import { destinationOptions, campusesFor } from "../../utils/universityFilter";
import type { Student } from "../../types";

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
  const [courseName, setCourseName] = useState(initialCourseName ?? university?.courses[0]?.name ?? "");
  const course = university?.courses.find((c) => c.name === courseName);
  const campuses = university && course ? campusesFor(university, course.feeUSD) : [];
  const [campus, setCampus] = useState(campuses[0]?.name ?? "");
  const [intake, setIntake] = useState(university?.intakes[0] ?? "");
  const student = students.find((s) => s.id === studentId);
  const canSubmit = !!student && !!university && !!courseName && !!campus && !!intake;

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
              const c = u?.courses[0];
              setCourseName(c?.name ?? "");
              setCampus((u && c ? campusesFor(u, c.feeUSD) : [])[0]?.name ?? "");
              setIntake(u?.intakes[0] ?? "");
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
              const c = u?.courses[0];
              setCourseName(c?.name ?? "");
              setCampus((u && c ? campusesFor(u, c.feeUSD) : [])[0]?.name ?? "");
              setIntake(u?.intakes[0] ?? "");
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
                setCampus((c ? campusesFor(university, c.feeUSD) : [])[0]?.name ?? "");
              }}
              options={university.courses.map((c) => c.name)}
              placeholder="Search subjects…"
            />
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
            {(university?.intakes ?? []).map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </Field>
        <Button
          className="w-full justify-center"
          disabled={!canSubmit}
          onClick={async () => {
            if (!student || !university) return;
            await createApplication({
              studentId: student.id, university: university.name, course: courseName,
              intake, country: university.country, campus,
            });
            onCreated();
            onClose();
          }}
        >
          Create application
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
