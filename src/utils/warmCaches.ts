// Kicks off the initial fetch for every Postgres-backed store's in-memory cache — called once a
// valid JWT is known to exist (see AuthContext.tsx), since a fetch fired before login would just
// fail with 401. Each store's own cache stays synchronous for readers; this only starts the
// background load that fills it in.
import { refreshApplications } from "../data/applicationsStore";
import { refreshTasks } from "../data/tasksStore";
import { refreshStaff } from "../data/staffStore";
import { refreshAgentStudents } from "../data/agentStudentsStore";
import { refreshAssignedStudents } from "../data/counsellorStudentsStore";
import { refreshAllStudents } from "../data/allStudentsStore";

export function warmCaches() {
  refreshApplications().catch((err) => console.warn("Failed to warm applications cache:", err));
  refreshTasks().catch((err) => console.warn("Failed to warm tasks cache:", err));
  refreshStaff().catch((err) => console.warn("Failed to warm staff cache:", err));
  refreshAgentStudents().catch((err) => console.warn("Failed to warm agent-students cache:", err));
  refreshAssignedStudents().catch((err) => console.warn("Failed to warm counsellor-students cache:", err));
  refreshAllStudents().catch((err) => console.warn("Failed to warm all-students cache:", err));
}
