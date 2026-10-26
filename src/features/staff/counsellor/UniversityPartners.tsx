// The counsellor's partner-university page is the student's Explore page (same tabs, search, Advanced Search, sorting and
// cards) — pointed at the counsellor's own detail routes, with "Apply" opening a create-application flow for one of their
// students instead of applying as themselves.
import { ExploreUniversities, type ExploreVariant } from "../../student/UniversitySearch";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import { activeApplicationsFor } from "../../../utils/counsellorData";

const COUNSELLOR_EXPLORE: ExploreVariant = {
  basePath: "/staff/counsellor/partners",
  title: "University Partners",
  universityPath: (id) => `/staff/counsellor/partners/universities/${id}`,
  countryPath: (name) => `/staff/counsellor/partners/${encodeURIComponent(name)}`,
  ownApplications: false,
  students: () => loadAssignedStudents(),
  universityNote: (u) => {
    const applying = loadAssignedStudents().flatMap((s) => activeApplicationsFor(s.id)).filter((a) => a.university === u.name).length;
    return (
      <p className="mt-1.5 text-[11px] font-medium text-neutral-600 sm:text-xs">
        {applying > 0
          ? `${applying} of your student${applying === 1 ? "" : "s"} applying here`
          : "None of your students applying here yet"}
      </p>
    );
  },
};

export default function CounsellorUniversityPartners() {
  return <ExploreUniversities variant={COUNSELLOR_EXPLORE} />;
}
