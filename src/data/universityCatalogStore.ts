// The live partner-university catalog — the seeded UNIVERSITIES array plus anything the Data
// Management team adds or edits, merged together. Every page that lets someone *browse* or *look
// up* universities (student, agent, counsellor, and the admin commission-rate table) should read
// through `getAllUniversities()`/`getUniversityById()` instead of importing the raw seed array
// directly, so a newly added university or course actually shows up everywhere, live, without a
// page reload — the same "instant persist" standard every other store in this app follows.

import { UNIVERSITIES as SEED_UNIVERSITIES } from "./mockData";
import { getCountryId } from "./countryRegistry";
import type { University } from "../types";

const CREATED_KEY = "data-mgmt-created-universities";
const OVERRIDES_KEY = "data-mgmt-university-overrides";
const DELETED_KEY = "data-mgmt-deleted-university-ids";

function loadCreated(): University[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CREATED_KEY);
    return raw ? (JSON.parse(raw) as University[]) : [];
  } catch {
    return [];
  }
}

function saveCreated(list: University[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CREATED_KEY, JSON.stringify(list));
}

function loadOverrides(): Record<string, Partial<University>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Partial<University>>) : {};
  } catch {
    return {};
  }
}

function saveOverrides(map: Record<string, Partial<University>>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map));
}

function loadDeleted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DELETED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDeleted(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));
}

/** Every partner university — seeded catalog (with any admin edits applied, and any admin
 * deletions removed) plus everything Data Management has added this session.
 *
 * Re-derives `subjects` from each university's courses on every read (not just on write, see
 * addUniversity/updateUniversity below) so a university saved before that derivation existed
 * self-heals here instead of staying invisible to subject browsing until someone re-edits it.
 * Also normalizes `requirements`/`englishRequirements` on every read — both used to be one flat
 * list/array before they were split by degree level (Undergraduate vs. Postgraduate), and a
 * university saved under that older shape would otherwise crash the Requirements tab the moment
 * something calls `.undergraduate` on what's still a plain array in storage. */
export function getAllUniversities(): University[] {
  const overrides = loadOverrides();
  const deleted = loadDeleted();
  const seedMerged = SEED_UNIVERSITIES.filter((u) => !deleted.has(u.id)).map((u) => (overrides[u.id] ? { ...u, ...overrides[u.id] } : u));
  const created = loadCreated().filter((u) => !deleted.has(u.id));
  return [...seedMerged, ...created].map((u) => ({
    ...u,
    subjects: mergedSubjects(u.subjects, u.courses),
    requirements: normalizeRequirements(u.requirements),
    englishRequirements: normalizeEnglishRequirements(u.englishRequirements),
  }));
}

/** Accepts either the current `{ undergraduate, postgraduate }` shape or the pre-migration flat
 * array a university may still have in storage. A legacy flat list is duplicated into both levels
 * rather than picked for one — nothing a data manager already entered silently disappears; they
 * can trim whichever side doesn't apply next time they edit this university. */
function normalizeRequirements(requirements: unknown): University["requirements"] {
  if (Array.isArray(requirements)) return { undergraduate: requirements, postgraduate: requirements };
  if (requirements && typeof requirements === "object") return requirements as University["requirements"];
  return { undergraduate: [], postgraduate: [] };
}

function normalizeEnglishRequirements(englishRequirements: unknown): University["englishRequirements"] {
  if (Array.isArray(englishRequirements)) return { undergraduate: englishRequirements, postgraduate: englishRequirements };
  if (englishRequirements && typeof englishRequirements === "object") return englishRequirements as University["englishRequirements"];
  return undefined;
}

export function getUniversityById(id: string): University | undefined {
  return getAllUniversities().find((u) => u.id === id);
}

export function isCustomUniversity(id: string): boolean {
  return loadCreated().some((u) => u.id === id);
}

// `University.subjects` is the union of two things: the broad subject genres Data Management
// explicitly picks for the university (via the form's multi-select, e.g. to advertise "Business &
// Management" before any course under it exists yet) and whatever subject each of its courses
// actually carries. Every browse-by-subject page in the app (SubjectDetail on student/agent, the
// assistant tools, universityFilter.ts) filters universities by this tag list first, then looks
// for a matching course inside it — merging here, at the one place courses enter storage, means a
// course's subject can never go "invisible" just because nobody also multi-selected its genre.
function mergedSubjects(manual: string[] | undefined, courses: University["courses"]): string[] {
  return Array.from(new Set([...(manual ?? []), ...courses.map((c) => c.subject).filter(Boolean)]));
}

export function addUniversity(data: Omit<University, "id">): University {
  const university: University = { ...data, subjects: mergedSubjects(data.subjects, data.courses), id: `u-custom-${Date.now().toString(36)}` };
  // Registers the country with a stable id the moment it's introduced, even though University
  // still stores the plain name — the registry is what a real countries table would become.
  getCountryId(university.country);
  saveCreated([...loadCreated(), university]);
  return university;
}

export function updateUniversity(id: string, patch: Partial<University>) {
  if (patch.country) getCountryId(patch.country);
  // A course-only patch (addCourse/updateCourse/removeCourse below) never carries `subjects`, so
  // fall back to whatever's already stored — this is what keeps a newly added course's subject
  // folded in without discarding the manual genres Data Management picked on the university form.
  const manualSubjects = patch.subjects ?? getUniversityById(id)?.subjects;
  const effectivePatch = patch.courses ? { ...patch, subjects: mergedSubjects(manualSubjects, patch.courses) } : patch;
  const created = loadCreated();
  const idx = created.findIndex((u) => u.id === id);
  if (idx >= 0) {
    created[idx] = { ...created[idx], ...effectivePatch };
    saveCreated(created);
    return;
  }
  const overrides = loadOverrides();
  overrides[id] = { ...overrides[id], ...effectivePatch };
  saveOverrides(overrides);
}

export function deleteUniversity(id: string) {
  const created = loadCreated();
  if (created.some((u) => u.id === id)) {
    saveCreated(created.filter((u) => u.id !== id));
    return;
  }
  const deleted = loadDeleted();
  deleted.add(id);
  saveDeleted(deleted);
}

type Course = University["courses"][number];

export function addCourse(universityId: string, course: Omit<Course, "id">): Course {
  const uni = getUniversityById(universityId);
  const newCourse: Course = { ...course, id: `crs-custom-${Date.now().toString(36)}` };
  if (uni) updateUniversity(universityId, { courses: [...uni.courses, newCourse] });
  return newCourse;
}

/** Courses are matched by `id`, not name — a course's name is just a display field an editor can
 * freely change without breaking the reference to it (the same reason universities aren't matched
 * by name either). */
export function updateCourse(universityId: string, courseId: string, patch: Partial<Course>) {
  const uni = getUniversityById(universityId);
  if (!uni) return;
  updateUniversity(universityId, { courses: uni.courses.map((c) => (c.id === courseId ? { ...c, ...patch } : c)) });
}

export function removeCourse(universityId: string, courseId: string) {
  const uni = getUniversityById(universityId);
  if (!uni) return;
  updateUniversity(universityId, { courses: uni.courses.filter((c) => c.id !== courseId) });
}
