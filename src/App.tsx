import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { GOOGLE_CLIENT_ID } from "./utils/googleClientId";
import { RequireAuth } from "./layouts/RequireAuth";
import { ROLE_HOME } from "./layouts/nav";

// Every route below (and each role's whole shell) is lazy — previously all ~90 of these were
// eagerly imported here, so every visitor's very first load downloaded every role's every page
// regardless of which one they'd actually use, inflating the main JS bundle to ~1.4MB. Only the
// route(s) actually navigated to are fetched now; a shared <Suspense> boundary around <Routes>
// covers the brief gap while a chunk loads. The JSX below (<X />) is unchanged either way — a
// lazy component is used identically to a regular one once it's assigned to a name here.
const Login = lazy(() => import("./features/auth/Login"));
const Signup = lazy(() => import("./features/auth/Signup"));
const AcceptInvite = lazy(() => import("./features/auth/AcceptInvite"));
const AppLayout = lazy(() => import("./layouts/AppLayout"));
const AdminShell = lazy(() => import("./layouts/AdminShell"));
const StudentShell = lazy(() => import("./layouts/StudentShell"));
const CounsellorShell = lazy(() => import("./layouts/CounsellorShell"));
const AgentShell = lazy(() => import("./layouts/AgentShell"));

const StudentOnboarding = lazy(() => import("./features/student/Onboarding"));
const StudentDashboard = lazy(() => import("./features/student/Dashboard"));
const StudentApplications = lazy(() => import("./features/student/Applications"));
const StudentApplicationDetail = lazy(() => import("./features/student/ApplicationDetail"));
const StudentDocuments = lazy(() => import("./features/student/Documents"));
const StudentNotifications = lazy(() => import("./features/student/Notifications"));
const StudentTasks = lazy(() => import("./features/student/Tasks"));
const StudentInterviewPrep = lazy(() => import("./features/student/InterviewPrep"));
const UniversitySearch = lazy(() => import("./features/student/UniversitySearch"));
const UniversityFilters = lazy(() => import("./features/student/UniversityFilters"));
const UniversityDetail = lazy(() => import("./features/student/UniversityDetail"));
const CampusOptions = lazy(() => import("./features/student/CampusOptions"));
const SubjectDetail = lazy(() => import("./features/student/SubjectDetail"));
const CountryDetail = lazy(() => import("./features/student/CountryDetail"));
const AICounsellor = lazy(() => import("./features/student/AICounsellor"));
const CostPlanner = lazy(() => import("./features/student/CostPlanner"));
const StudentMessages = lazy(() => import("./features/student/Messages"));
const StudentProfile = lazy(() => import("./features/student/Profile"));
const PersonalInformation = lazy(() => import("./features/student/PersonalInformation"));
const AcademicDetails = lazy(() => import("./features/student/AcademicDetails"));
const EnglishProficiency = lazy(() => import("./features/student/EnglishProficiency"));
const WorkExperience = lazy(() => import("./features/student/WorkExperience"));
const Preferences = lazy(() => import("./features/student/Preferences"));
const ChangePassword = lazy(() => import("./features/student/ChangePassword"));

const AgentDashboard = lazy(() => import("./features/agent/Dashboard"));
const AgentStudents = lazy(() => import("./features/agent/Students"));
const AgentStudentProfile = lazy(() => import("./features/agent/StudentProfile"));
const AgentCreateStudentProfile = lazy(() => import("./features/agent/CreateStudentProfile"));
const AgentApplications = lazy(() => import("./features/agent/Applications"));
const AgentUniversities = lazy(() => import("./features/agent/Universities"));
const AgentUniversityDetail = lazy(() => import("./features/agent/UniversityDetail"));
const AgentCampusOptions = lazy(() => import("./features/agent/CampusOptions"));
const AgentSubjectDetail = lazy(() => import("./features/agent/SubjectDetail"));
const AgentCountryDetail = lazy(() => import("./features/agent/CountryDetail"));
const AgentOffers = lazy(() => import("./features/agent/Offers"));
const AgentVisaCompliance = lazy(() => import("./features/agent/VisaCompliance"));
const AgentCommissions = lazy(() => import("./features/agent/Commissions"));
const AgentStatements = lazy(() => import("./features/agent/Statements"));
const AgentTasks = lazy(() => import("./features/agent/Tasks"));
const AgentProfile = lazy(() => import("./features/agent/Profile"));
const AgentMessages = lazy(() => import("./features/agent/Messages"));

const CounsellorDashboard = lazy(() => import("./features/staff/counsellor/Dashboard"));
const CounsellorLeads = lazy(() => import("./features/staff/counsellor/Leads"));
const CounsellorCaseQueue = lazy(() => import("./features/staff/counsellor/CaseQueue"));
const CounsellorStudentProfile = lazy(() => import("./features/staff/counsellor/StudentProfile"));
const CounsellorTasks = lazy(() => import("./features/staff/counsellor/Tasks"));
const CounsellorMessages = lazy(() => import("./features/staff/counsellor/Messages"));
const CounsellorApplications = lazy(() => import("./features/staff/counsellor/Applications"));
const CounsellorCounseling = lazy(() => import("./features/staff/counsellor/Counseling"));
const CounsellorUniversityPartners = lazy(() => import("./features/staff/counsellor/UniversityPartners"));
const CounsellorCountryDetail = lazy(() => import("./features/staff/counsellor/CountryDetail"));
const CounsellorUniversityDetail = lazy(() => import("./features/staff/counsellor/UniversityDetail"));
const CounsellorVisaCompliance = lazy(() => import("./features/staff/counsellor/VisaCompliance"));
const CounsellorReports = lazy(() => import("./features/staff/counsellor/Reports"));
const CounsellorResources = lazy(() => import("./features/staff/counsellor/Resources"));
const CounsellorSettings = lazy(() => import("./features/staff/counsellor/Settings"));
const AdmissionSubmissionQueue = lazy(() => import("./features/staff/admission/SubmissionQueue"));
const SharedMessages = lazy(() => import("./features/shared/Messages"));
const ComplianceRiskQueue = lazy(() => import("./features/staff/compliance/RiskQueue"));
const DataCatalog = lazy(() => import("./features/staff/data/Catalog"));
const DataSubjects = lazy(() => import("./features/staff/data/Subjects"));
const DataSubjectForm = lazy(() => import("./features/staff/data/SubjectForm"));
const DataCountries = lazy(() => import("./features/staff/data/Countries"));
const DataUniversities = lazy(() => import("./features/staff/data/Universities"));
const DataUniversityDetail = lazy(() => import("./features/staff/data/UniversityDetail"));
const DataUniversityForm = lazy(() => import("./features/staff/data/UniversityForm"));
const DataCountryForm = lazy(() => import("./features/staff/data/CountryForm"));
const DataCourseForm = lazy(() => import("./features/staff/data/CourseForm"));
const DataCourseImport = lazy(() => import("./features/staff/data/CourseImport"));
const DataUniversityImport = lazy(() => import("./features/staff/data/UniversityImport"));
const FinanceCommissionApprovals = lazy(() => import("./features/staff/finance/CommissionApprovals"));

const AdminUsersRoles = lazy(() => import("./features/admin/UsersRoles"));
const AdminAgents = lazy(() => import("./features/admin/Agents"));
const AdminStudents = lazy(() => import("./features/admin/Students"));
const AdminWorkflowTemplates = lazy(() => import("./features/admin/WorkflowTemplates"));
const AdminCommissionRules = lazy(() => import("./features/admin/CommissionRules"));
const AdminAuditLogs = lazy(() => import("./features/admin/AuditLogs"));
const AdminTasks = lazy(() => import("./features/admin/Tasks"));
const AdminAISettings = lazy(() => import("./features/admin/AISettings"));
const AdminNotifications = lazy(() => import("./features/admin/Notifications"));
const AdminDashboard = lazy(() => import("./features/admin/Dashboard"));
const AdminApplications = lazy(() => import("./features/admin/Applications"));
const AdminCalendar = lazy(() => import("./features/admin/Calendar"));
const AdminSettings = lazy(() => import("./features/admin/Settings"));

// Admin gets its own UnifinderAi-branded shell (see layouts/AdminShell.tsx); the other staff roles
// share AppLayout. Same route table underneath either way.
function StaffShell() {
  const { user } = useAuth();
  return user?.role === "admin" ? <AdminShell /> : <AppLayout />;
}

// Where "/" and any unmatched path should land — depends on which role is actually logged in,
// not a fixed guess, since this app now has more than one possible home.
function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? ROLE_HOME[user.role] : "/login"} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
});

// Only mounts the real provider once a Google OAuth client is actually configured — GoogleLogin
// buttons stay hidden (see GoogleSignInButton.tsx) until then, so there's nothing for it to back.
function MaybeGoogleOAuthProvider({ children }: { children: React.ReactNode }) {
  if (!GOOGLE_CLIENT_ID) return <>{children}</>;
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <MaybeGoogleOAuthProvider>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Same page/logic as /login (login is role-agnostic — the backend returns whatever
              role the account actually has) — just a distinct URL to hand to staff/admin instead
              of the student-facing one. */}
          <Route path="/staff/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/accept-invite/:token" element={<AcceptInvite />} />

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
            <Route path="/student/countries/:country" element={<CountryDetail />} />
            <Route path="/student/applications" element={<StudentApplications />} />
            <Route path="/student/applications/:id" element={<StudentApplicationDetail />} />
            <Route path="/student/documents" element={<StudentDocuments />} />
            <Route path="/student/notifications" element={<StudentNotifications />} />
            <Route path="/student/tasks" element={<StudentTasks />} />
            <Route path="/student/interview-prep" element={<StudentInterviewPrep />} />
            <Route path="/student/counsellor" element={<AICounsellor />} />
            <Route path="/student/cost-planner" element={<CostPlanner />} />
            <Route path="/student/messages" element={<StudentMessages />} />
            <Route path="/student/profile" element={<StudentProfile />} />
            <Route path="/student/profile/personal-information" element={<PersonalInformation />} />
            <Route path="/student/profile/academic-details" element={<AcademicDetails />} />
            <Route path="/student/profile/english-proficiency" element={<EnglishProficiency />} />
            <Route path="/student/profile/work-experience" element={<WorkExperience />} />
            <Route path="/student/profile/preferences" element={<Preferences />} />
            <Route path="/student/profile/security" element={<ChangePassword />} />
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
            <Route path="/staff/counsellor/partners/universities/:id" element={<CounsellorUniversityDetail />} />
            <Route path="/staff/counsellor/partners/:country" element={<CounsellorCountryDetail />} />
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
            <Route path="/agent/countries/:country" element={<AgentCountryDetail />} />
            <Route path="/agent/offers" element={<AgentOffers />} />
            <Route path="/agent/visa-compliance" element={<AgentVisaCompliance />} />
            <Route path="/agent/commissions" element={<AgentCommissions />} />
            <Route path="/agent/statements" element={<AgentStatements />} />
            <Route path="/agent/tasks" element={<AgentTasks />} />
            <Route path="/agent/profile" element={<AgentProfile />} />
            <Route path="/agent/messages" element={<AgentMessages />} />
          </Route>
          </Route>

          <Route element={<RequireAuth roles={["admission", "compliance", "data", "finance", "admin"]} />}>
          <Route element={<StaffShell />}>
            <Route path="/" element={<RoleHomeRedirect />} />

            <Route path="/messages" element={<SharedMessages />} />

            {/* Staff */}
            <Route path="/staff/admission" element={<AdmissionSubmissionQueue />} />
            <Route path="/staff/compliance" element={<ComplianceRiskQueue />} />
            <Route path="/staff/data" element={<DataCountries />} />
            <Route path="/staff/data/countries/new" element={<DataCountryForm />} />
            <Route path="/staff/data/countries/:country" element={<DataUniversities />} />
            <Route path="/staff/data/countries/:country/edit" element={<DataCountryForm />} />
            <Route path="/staff/data/universities" element={<DataUniversities />} />
            <Route path="/staff/data/universities/import" element={<DataUniversityImport />} />
            <Route path="/staff/data/universities/new" element={<DataUniversityForm />} />
            <Route path="/staff/data/universities/:id" element={<DataUniversityDetail />} />
            <Route path="/staff/data/universities/:id/edit" element={<DataUniversityForm />} />
            <Route path="/staff/data/universities/:id/courses/import" element={<DataCourseImport />} />
            <Route path="/staff/data/universities/:id/courses/new" element={<DataCourseForm />} />
            <Route path="/staff/data/universities/:id/courses/:courseId" element={<DataCourseForm />} />
            <Route path="/staff/data/subjects" element={<DataSubjects />} />
            <Route path="/staff/data/subjects/new" element={<DataSubjectForm />} />
            <Route path="/staff/data/subjects/:id" element={<DataSubjectForm />} />
            <Route path="/staff/data/catalog" element={<DataCatalog />} />
            <Route path="/staff/finance" element={<FinanceCommissionApprovals />} />

            <Route path="*" element={<RoleHomeRedirect />} />
          </Route>
          </Route>

          {/* Admin — same shell, but only the admin role; the other staff roles above are bounced
              to their own home if they type an /admin URL. */}
          <Route element={<RequireAuth roles={["admin"]} />}>
          <Route element={<StaffShell />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/applications" element={<AdminApplications />} />
            <Route path="/admin/teams" element={<AdminUsersRoles />} />
            <Route path="/admin/agents" element={<AdminAgents />} />
            <Route path="/admin/calendar" element={<AdminCalendar />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/workflows" element={<AdminWorkflowTemplates />} />
            <Route path="/admin/commission-rules" element={<AdminCommissionRules />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
            <Route path="/admin/tasks" element={<AdminTasks />} />
            <Route path="/admin/ai-settings" element={<AdminAISettings />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />
          </Route>
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </MaybeGoogleOAuthProvider>
    </QueryClientProvider>
  );
}

// Shown only for the brief moment a lazy route's own chunk is downloading — most navigations
// within an already-visited area won't hit this at all, since the browser caches the chunk after
// its first fetch. Deliberately minimal (no branded spinner asset to load) so it can never itself
// be the thing something is waiting on.
function RouteLoadingFallback() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
    </div>
  );
}
