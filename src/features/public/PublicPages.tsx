// The logged-out /universities, /courses and /universities/:id pages. They ARE the student pages — Explore, Advanced Search and
// the university/course detail — rendered in "public mode" (see data/publicMode.ts): same components and information, public data
// endpoints, and every signed-in action leads to the sign-in page. Wrapped in the student visual theme with the public header.
import { useEffect, type ReactNode } from "react";
import { ExploreUniversities, type ExploreVariant } from "../student/UniversitySearch";
import UniversityDetail from "../student/UniversityDetail";
import { PublicHeader } from "./News";
import { PublicModeContext, loadPublicReference } from "../../data/publicMode";

function PublicShell({ children }: { children: ReactNode }) {
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
  universityPath: (id) => `/universities/${id}`,
  countryPath: () => "/login",
  ownApplications: false,
  publicMode: true,
  tabs: ["universities", "subjects"],
};

const UNIVERSITIES: ExploreVariant = { ...common, basePath: "/universities", title: "Explore Universities", defaultTab: "universities" };
const COURSES: ExploreVariant = { ...common, basePath: "/courses", title: "Explore Courses", defaultTab: "subjects" };

export function PublicUniversities() {
  return <PublicShell><ExploreUniversities variant={UNIVERSITIES} /></PublicShell>;
}
export function PublicCourses() {
  return <PublicShell><ExploreUniversities variant={COURSES} /></PublicShell>;
}
export function PublicUniversityDetail() {
  return <PublicShell><UniversityDetail /></PublicShell>;
}
