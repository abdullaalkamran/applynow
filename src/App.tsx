import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RequireAuth } from "./layouts/RequireAuth";
import { ROLE_HOME } from "./layouts/nav";
import Login from "./features/auth/Login";
import AppLayout from "./layouts/AppLayout";
import StudentShell from "./layouts/StudentShell";
import CounsellorShell from "./layouts/CounsellorShell";
import AgentShell from "./layouts/AgentShell";

import StudentOnboarding from "./features/student/Onboarding";
import StudentDashboard from "./features/student/Dashboard";
import StudentApplications from "./features/student/Applications";
import StudentApplicationDetail from "./features/student/ApplicationDetail";
import StudentDocuments from "./features/student/Documents";
import StudentNotifications from "./features/student/Notifications";
import StudentTasks from "./features/student/Tasks";
import UniversitySearch from "./features/student/UniversitySearch";
import UniversityFilters from "./features/student/UniversityFilters";
import UniversityDetail from "./features/student/UniversityDetail";
import CampusOptions from "./features/student/CampusOptions";
import SubjectDetail from "./features/student/SubjectDetail";
import AICounsellor from "./features/student/AICounsellor";
import CostPlanner from "./features/student/CostPlanner";
import StudentMessages from "./features/student/Messages";
import StudentProfile from "./features/student/Profile";
import PersonalInformation from "./features/student/PersonalInformation";
import AcademicDetails from "./features/student/AcademicDetails";
import EnglishProficiency from "./features/student/EnglishProficiency";
import WorkExperience from "./features/student/WorkExperience";
import Preferences from "./features/student/Preferences";

import AgentDashboard from "./features/agent/Dashboard";
import AgentStudents from "./features/agent/Students";
import AgentStudentProfile from "./features/agent/StudentProfile";
import AgentCreateStudentProfile from "./features/agent/CreateStudentProfile";
import AgentApplications from "./features/agent/Applications";
import AgentUniversities from "./features/agent/Universities";
import AgentUniversityDetail from "./features/agent/UniversityDetail";
import AgentCampusOptions from "./features/agent/CampusOptions";
import AgentSubjectDetail from "./features/agent/SubjectDetail";
import AgentOffers from "./features/agent/Offers";
import AgentVisaCompliance from "./features/agent/VisaCompliance";
import AgentCommissions from "./features/agent/Commissions";
import AgentStatements from "./features/agent/Statements";
import AgentTasks from "./features/agent/Tasks";

import CounsellorDashboard from "./features/staff/counsellor/Dashboard";
import CounsellorLeads from "./features/staff/counsellor/Leads";
import CounsellorCaseQueue from "./features/staff/counsellor/CaseQueue";
import CounsellorStudentProfile from "./features/staff/counsellor/StudentProfile";
import CounsellorTasks from "./features/staff/counsellor/Tasks";
import CounsellorMessages from "./features/staff/counsellor/Messages";
import CounsellorApplications from "./features/staff/counsellor/Applications";
import CounsellorCounseling from "./features/staff/counsellor/Counseling";
import CounsellorUniversityPartners from "./features/staff/counsellor/UniversityPartners";
import CounsellorVisaCompliance from "./features/staff/counsellor/VisaCompliance";
import CounsellorReports from "./features/staff/counsellor/Reports";
import CounsellorResources from "./features/staff/counsellor/Resources";
import CounsellorSettings from "./features/staff/counsellor/Settings";
import AdmissionSubmissionQueue from "./features/staff/admission/SubmissionQueue";
import ComplianceRiskQueue from "./features/staff/compliance/RiskQueue";
import DataCatalog from "./features/staff/data/Catalog";
import DataCountries from "./features/staff/data/Countries";
import DataUniversities from "./features/staff/data/Universities";
import DataUniversityDetail from "./features/staff/data/UniversityDetail";
import DataUniversityForm from "./features/staff/data/UniversityForm";
import DataCourseForm from "./features/staff/data/CourseForm";
import FinanceCommissionApprovals from "./features/staff/finance/CommissionApprovals";

import AdminUsersRoles from "./features/admin/UsersRoles";
import AdminWorkflowTemplates from "./features/admin/WorkflowTemplates";
import AdminCommissionRules from "./features/admin/CommissionRules";
import AdminAuditLogs from "./features/admin/AuditLogs";
import AdminTasks from "./features/admin/Tasks";
import AdminAISettings from "./features/admin/AISettings";
import AdminNotifications from "./features/admin/Notifications";

// Where "/" and any unmatched path should land — depends on which role is actually logged in,
// not a fixed guess, since this app now has more than one possible home.
function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? ROLE_HOME[user.role] : "/login"} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Student — mobile app shell (no sidebar/topbar) */}
          <Route element={<RequireAuth roles={["student"]} />}>
          <Route element={<StudentShell />}>
            <Route path="/student/onboarding" element={<StudentOnboarding />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/search" element={<UniversitySearch />}>
              <Route path="filters" element={<UniversityFilters />} />
            </Route>
            <Route path="/student/universities/:id" element={<UniversityDetail />} />
            <Route path="/student/universities/:id/campuses" element={<CampusOptions />} />
            <Route path="/student/subjects/:subject" element={<SubjectDetail />} />
            <Route path="/student/applications" element={<StudentApplications />} />
            <Route path="/student/applications/:id" element={<StudentApplicationDetail />} />
            <Route path="/student/documents" element={<StudentDocuments />} />
            <Route path="/student/notifications" element={<StudentNotifications />} />
            <Route path="/student/tasks" element={<StudentTasks />} />
            <Route path="/student/counsellor" element={<AICounsellor />} />
            <Route path="/student/cost-planner" element={<CostPlanner />} />
            <Route path="/student/messages" element={<StudentMessages />} />
            <Route path="/student/profile" element={<StudentProfile />} />
            <Route path="/student/profile/personal-information" element={<PersonalInformation />} />
            <Route path="/student/profile/academic-details" element={<AcademicDetails />} />
            <Route path="/student/profile/english-proficiency" element={<EnglishProficiency />} />
            <Route path="/student/profile/work-experience" element={<WorkExperience />} />
            <Route path="/student/profile/preferences" element={<Preferences />} />
          </Route>
          </Route>

          {/* Counsellor — dedicated ApplyHub-branded shell, separate from the shared staff/admin shell */}
          <Route element={<RequireAuth roles={["counsellor"]} />}>
          <Route element={<CounsellorShell />}>
            <Route path="/staff/counsellor" element={<CounsellorDashboard />} />
            <Route path="/staff/counsellor/leads" element={<CounsellorLeads />} />
            <Route path="/staff/counsellor/students" element={<CounsellorCaseQueue />} />
            <Route path="/staff/counsellor/students/:id" element={<CounsellorStudentProfile />} />
            <Route path="/staff/counsellor/applications" element={<CounsellorApplications />} />
            <Route path="/staff/counsellor/counseling" element={<CounsellorCounseling />} />
            <Route path="/staff/counsellor/partners" element={<CounsellorUniversityPartners />} />
            <Route path="/staff/counsellor/visa-compliance" element={<CounsellorVisaCompliance />} />
            <Route path="/staff/counsellor/tasks" element={<CounsellorTasks />} />
            <Route path="/staff/counsellor/messages" element={<CounsellorMessages />} />
            <Route path="/staff/counsellor/reports" element={<CounsellorReports />} />
            <Route path="/staff/counsellor/resources" element={<CounsellorResources />} />
            <Route path="/staff/counsellor/settings" element={<CounsellorSettings />} />
          </Route>
          </Route>

          {/* Agent — dedicated EduBridge-branded shell, separate from the shared staff/admin shell */}
          <Route element={<RequireAuth roles={["agent"]} />}>
          <Route element={<AgentShell />}>
            <Route path="/agent" element={<AgentDashboard />} />
            <Route path="/agent/students" element={<AgentStudents />} />
            <Route path="/agent/students/new" element={<AgentCreateStudentProfile />} />
            <Route path="/agent/students/:id" element={<AgentStudentProfile />} />
            <Route path="/agent/applications" element={<AgentApplications />} />
            <Route path="/agent/universities" element={<AgentUniversities />} />
            <Route path="/agent/universities/:id" element={<AgentUniversityDetail />} />
            <Route path="/agent/universities/:id/campuses" element={<AgentCampusOptions />} />
            <Route path="/agent/subjects/:subject" element={<AgentSubjectDetail />} />
            <Route path="/agent/offers" element={<AgentOffers />} />
            <Route path="/agent/visa-compliance" element={<AgentVisaCompliance />} />
            <Route path="/agent/commissions" element={<AgentCommissions />} />
            <Route path="/agent/statements" element={<AgentStatements />} />
            <Route path="/agent/tasks" element={<AgentTasks />} />
          </Route>
          </Route>

          <Route element={<RequireAuth roles={["admission", "compliance", "data", "finance", "admin"]} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<RoleHomeRedirect />} />

            {/* Staff */}
            <Route path="/staff/admission" element={<AdmissionSubmissionQueue />} />
            <Route path="/staff/compliance" element={<ComplianceRiskQueue />} />
            <Route path="/staff/data" element={<DataCountries />} />
            <Route path="/staff/data/countries/:country" element={<DataUniversities />} />
            <Route path="/staff/data/universities" element={<DataUniversities />} />
            <Route path="/staff/data/universities/new" element={<DataUniversityForm />} />
            <Route path="/staff/data/universities/:id" element={<DataUniversityDetail />} />
            <Route path="/staff/data/universities/:id/edit" element={<DataUniversityForm />} />
            <Route path="/staff/data/universities/:id/courses/new" element={<DataCourseForm />} />
            <Route path="/staff/data/universities/:id/courses/:courseId" element={<DataCourseForm />} />
            <Route path="/staff/data/catalog" element={<DataCatalog />} />
            <Route path="/staff/finance" element={<FinanceCommissionApprovals />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminUsersRoles />} />
            <Route path="/admin/workflows" element={<AdminWorkflowTemplates />} />
            <Route path="/admin/commission-rules" element={<AdminCommissionRules />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
            <Route path="/admin/tasks" element={<AdminTasks />} />
            <Route path="/admin/ai-settings" element={<AdminAISettings />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />

            <Route path="*" element={<RoleHomeRedirect />} />
          </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </QueryClientProvider>
  );
}
