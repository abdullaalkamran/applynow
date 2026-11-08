// The logged-out /universities, /courses and /universities/:id pages. They ARE the student pages — Explore, Advanced Search and
// the university/course detail — rendered in "public mode" (see data/publicMode.ts): same components and information, public data
// endpoints, and every signed-in action leads to the sign-in page. Wrapped in the student visual theme with the public header.
import { useEffect, type ReactNode } from "react";
import { setPageMeta } from "../../utils/pageMeta";
import { ExploreUniversities, type ExploreVariant } from "../student/UniversitySearch";
import UniversityDetail from "../student/UniversityDetail";
import { PublicHeader } from "./News";
import { PublicModeContext, loadPublicReference } from "../../data/publicMode";
import { slugify } from "../../utils/slug";

export function PublicShell({ children }: { children: ReactNode }) {
  useEffect(() => { void loadPublicReference(); }, []);
  return (
    <PublicModeContext.Provider value={true}>
      <div className="neu-theme min-h-dvh w-full bg-[var(--sd-bg)] text-neutral-900">
        <PublicHeader />
        {children}
      </div>
    </PublicModeContext.Provider>
  );
}

const common: Omit<ExploreVariant, "basePath" | "title" | "defaultTab"> = {
  // Readable addresses (/universities/bpp-university/courses/msc-data-science); the id is only a fallback if no slug came back.
  universityPath: (id, slug) => `/universities/${encodeURIComponent(slug ?? id)}`,
  coursePath: (universityId, courseId, universitySlug, courseSlug) =>
    `/universities/${encodeURIComponent(universitySlug ?? universityId)}/courses/${encodeURIComponent(courseSlug ?? courseId)}`,
  // The country's public page (readable name; the server also accepts the plain name).
  countryPath: (name) => `/countries/${encodeURIComponent(slugify(name, "country"))}`,
  ownApplications: false,
  publicMode: true,
  tabs: ["universities", "subjects"],
};

const UNIVERSITIES: ExploreVariant = { ...common, basePath: "/universities", title: "Explore Universities", defaultTab: "universities" };
const COURSES: ExploreVariant = { ...common, basePath: "/courses", title: "Explore Courses", defaultTab: "subjects" };

export function PublicUniversities() {
  useEffect(() => setPageMeta("Explore Universities Worldwide — UnifinderAi", "Browse partner universities worldwide: location, courses, fees, intakes, scholarships and entry requirements."), []);
  return <PublicShell><ExploreUniversities variant={UNIVERSITIES} /></PublicShell>;
}
export function PublicCourses() {
  useEffect(() => setPageMeta("Explore Courses Worldwide — UnifinderAi", "Search courses at partner universities worldwide and compare level, duration, fees and intakes. Filter by country, subject and budget."), []);
  return <PublicShell><ExploreUniversities variant={COURSES} /></PublicShell>;
}
export function PublicUniversityDetail() {
  return <PublicShell><UniversityDetail /></PublicShell>;
}
