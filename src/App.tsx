import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RoleProvider } from "./context/RoleContext";
import AppLayout from "./layouts/AppLayout";
import StudentShell from "./layouts/StudentShell";
import CounsellorShell from "./layouts/CounsellorShell";

import StudentOnboarding from "./features/student/Onboarding";
import StudentDashboard from "./features/student/Dashboard";
import StudentApplications from "./features/student/Applications";
import StudentApplicationDetail from "./features/student/ApplicationDetail";
import StudentDocuments from "./features/student/Documents";
import StudentNotifications from "./features/student/Notifications";
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
import AgentApplications from "./features/agent/Applications";
import AgentCommissions from "./features/agent/Commissions";
import AgentStatements from "./features/agent/Statements";

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
import FinanceCommissionApprovals from "./features/staff/finance/CommissionApprovals";

import AdminUsersRoles from "./features/admin/UsersRoles";
import AdminWorkflowTemplates from "./features/admin/WorkflowTemplates";
import AdminCommissionRules from "./features/admin/CommissionRules";
import AdminAuditLogs from "./features/admin/AuditLogs";

export default function App() {
  return (
    <RoleProvider>
      <BrowserRouter>
        <Routes>
          {/* Student — mobile app shell (no sidebar/topbar) */}
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

          {/* Counsellor — dedicated ApplyHub-branded shell, separate from the shared staff/admin shell */}
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

          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/student/onboarding" replace />} />

            {/* Agent */}
            <Route path="/agent" element={<AgentDashboard />} />
            <Route path="/agent/students" element={<AgentStudents />} />
            <Route path="/agent/applications" element={<AgentApplications />} />
            <Route path="/agent/commissions" element={<AgentCommissions />} />
            <Route path="/agent/statements" element={<AgentStatements />} />

            {/* Staff */}
            <Route path="/staff/admission" element={<AdmissionSubmissionQueue />} />
            <Route path="/staff/compliance" element={<ComplianceRiskQueue />} />
            <Route path="/staff/data" element={<DataCatalog />} />
            <Route path="/staff/finance" element={<FinanceCommissionApprovals />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminUsersRoles />} />
            <Route path="/admin/workflows" element={<AdminWorkflowTemplates />} />
            <Route path="/admin/commission-rules" element={<AdminCommissionRules />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />

            <Route path="*" element={<Navigate to="/student" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </RoleProvider>
  );
}
