// One-line summaries shown on hover for each collapsed Overview section (see ExpandableSection) —
// kept separate from universityFilter.ts since these are purely display strings, not filter logic.
import type { University } from "../types";

function joinWithMore(items: string[], max: number): string {
  if (items.length === 0) return "";
  const shown = items.slice(0, max).join(", ");
  const extra = items.length - max;
  return extra > 0 ? `${shown} +${extra} more` : shown;
}

export function subjectsPreview(university: University): string {
  return joinWithMore(university.subjects, 3);
}

export function campusesPreview(university: University): string {
  return joinWithMore((university.campuses ?? []).map((c) => c.name), 2);
}

export function highlightsPreview(university: University): string {
  return university.highlights[0] ?? "";
}

export function intakesPreview(university: University): string {
  const open = university.intakes.filter((m) => university.intakeStatus?.[m]);
  if (open.length > 0) return `${open.join(", ")} open`;
  return university.intakes.join(", ");
}

export function scholarshipsPreview(university: University): string {
  const named = university.scholarships ?? [];
  if (named.length > 0) return `${named[0].name} — ${named[0].amount}`;
  return university.scholarshipsAvailable ? "Scholarships available" : "";
}

export function admissionStepsPreview(university: University): string {
  return university.admissionSteps?.[0] ?? "";
}
