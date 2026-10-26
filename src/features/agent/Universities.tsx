// The agent's university browser is the student's Explore page (same tabs, search, Advanced Search, sorting and cards) —
// pointed at the agent's own detail routes, with a per-student shortlist picker and "Apply" opening a create-application
// flow for one of their students.
import { ExploreUniversities, type ExploreVariant } from "../student/UniversitySearch";
import { loadAgentStudents } from "../../data/agentStudentsStore";
import { ShortlistButton } from "./ShortlistButton";

const AGENT_EXPLORE: ExploreVariant = {
  basePath: "/agent/universities",
  title: "Explore Universities",
  universityPath: (id) => `/agent/universities/${id}`,
  countryPath: (name) => `/agent/countries/${encodeURIComponent(name)}`,
  ownApplications: false,
  students: () => loadAgentStudents(),
  shortlistSlot: (university, course, students) => (
    <ShortlistButton students={students} universityId={university.id} universityName={university.name} courseName={course.name} />
  ),
};

export default function AgentUniversities() {
  return <ExploreUniversities variant={AGENT_EXPLORE} />;
}
