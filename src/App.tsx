import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RoleProvider } from "./context/RoleContext";
import AppLayout from "./layouts/AppLayout";
import StudentShell from "./layouts/StudentShell";

import StudentOnboarding from "./features/student/Onboarding";
import StudentDashboard from "./features/student/Dashboard";
import StudentApplications from "./features/student/Applications";
import StudentApplicationDetail from "./features/student/ApplicationDetail";
import StudentDocuments from "./features/student/Documents";
import UniversitySearch from "./features/student/UniversitySearch";
import UniversityDetail from "./features/student/UniversityDetail";
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

import CounsellorCaseQueue from "./features/staff/counsellor/CaseQueue";
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
            <Route path="/student/search" element={<UniversitySearch />} />
            <Route path="/student/universities/:id" element={<UniversityDetail />} />
            <Route path="/student/applications" element={<StudentApplications />} />
            <Route path="/student/applications/:id" element={<StudentApplicationDetail />} />
            <Route path="/student/documents" element={<StudentDocuments />} />
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

          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/student/onboarding" replace />} />

            {/* Agent */}
            <Route path="/agent" element={<AgentDashboard />} />
            <Route path="/agent/students" element={<AgentStudents />} />
            <Route path="/agent/applications" element={<AgentApplications />} />
            <Route path="/agent/commissions" element={<AgentCommissions />} />
            <Route path="/agent/statements" element={<AgentStatements />} />

            {/* Staff */}
            <Route path="/staff/counsellor" element={<CounsellorCaseQueue />} />
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
