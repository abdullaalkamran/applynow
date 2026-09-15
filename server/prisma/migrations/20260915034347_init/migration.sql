-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin');

-- CreateEnum
CREATE TYPE "RiskFlag" AS ENUM ('none', 'watch', 'high');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('Active', 'Invited', 'Inactive');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('Draft', 'Profile Incomplete', 'Documents Pending', 'Ready for Review', 'Eligibility Review', 'Application Preparing', 'Ready to Submit', 'Submitted', 'University Review', 'Additional Documents Requested', 'Offer Received', 'Offer Conditions Pending', 'Deposit Pending', 'Deposit Paid', 'CAS/COE Pending', 'CAS/COE Issued', 'Visa Preparation', 'Visa Submitted', 'Visa Decision', 'Enrolled', 'Deferred', 'Withdrawn', 'Rejected', 'Compliance Hold');

-- CreateEnum
CREATE TYPE "WaitingOn" AS ENUM ('student', 'staff', 'university', 'none');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('student', 'counsellor');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('application', 'offer', 'financial_readiness', 'payment', 'interview', 'university_document', 'visa', 'evisa', 'enrolment');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('pending', 'requested', 'uploaded', 'under_review', 'verified', 'rejected', 'flagged', 'expired');

-- CreateEnum
CREATE TYPE "DocumentScope" AS ENUM ('core', 'application', 'stage');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('NotEligible', 'Expected', 'Pending', 'Approved', 'Invoiced', 'Paid', 'Disputed', 'ClawedBack');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('Issued', 'Paid');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('Student', 'Agent', 'Document', 'Application');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('Open', 'Investigating', 'Frozen', 'Cleared', 'Escalated');

-- CreateEnum
CREATE TYPE "CatalogRecordType" AS ENUM ('University', 'Course', 'Intake', 'Requirement', 'Scholarship');

-- CreateEnum
CREATE TYPE "CatalogRecordStatus" AS ENUM ('Draft', 'InReview', 'Published', 'Stale');

-- CreateEnum
CREATE TYPE "WorkflowTemplateStatus" AS ENUM ('Active', 'Draft', 'Archived');

-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('document', 'financial_holding_period', 'immigration_document_type');

-- CreateEnum
CREATE TYPE "DepositMode" AS ENUM ('custom', 'half', 'full');

-- CreateEnum
CREATE TYPE "UniversityTone" AS ENUM ('violet', 'amber', 'teal', 'rose');

-- CreateEnum
CREATE TYPE "MeetingAction" AS ENUM ('Join', 'Email', 'Prepare', 'View');

-- CreateEnum
CREATE TYPE "MeetingKind" AS ENUM ('session', 'task');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "roleUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT NOT NULL,
    "agentId" TEXT,
    "counsellorId" TEXT,
    "avatarColor" TEXT NOT NULL,
    "riskFlag" "RiskFlag",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'Active',
    "organization" TEXT,
    "phone" TEXT,
    "avatarColor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "intake" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "campus" TEXT,
    "status" "AppStatus" NOT NULL,
    "progress" INTEGER NOT NULL,
    "nextAction" TEXT NOT NULL,
    "waitingOn" "WaitingOn" NOT NULL,
    "stages" JSONB NOT NULL,
    "source" "ApplicationSource",
    "responsibleCounsellorId" TEXT,
    "responsibleAdmissionOfficerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationJourney" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "stages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStatusHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "AppStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationActivity" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stageType" "StageType",
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "performedById" TEXT NOT NULL,
    "performedByRole" "Role" NOT NULL,
    "performedByName" TEXT NOT NULL,

    CONSTRAINT "ApplicationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedToId" TEXT NOT NULL,
    "assignedToRole" "Role" NOT NULL,
    "assignedToName" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedByRole" "Role" NOT NULL,
    "assignedByName" TEXT NOT NULL,
    "dueDate" DATE,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" TEXT,
    "studentName" TEXT,
    "applicationId" TEXT,
    "stageType" "StageType",
    "taskType" TEXT,
    "priority" "Priority",
    "externalOwner" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "fromRole" "Role" NOT NULL,
    "fromName" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "toRole" "Role" NOT NULL,
    "toName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "applicationId" TEXT,
    "stageType" "StageType",
    "scope" "DocumentScope" NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'pending',
    "fileUrl" TEXT,
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "rejectionReason" TEXT,
    "issuedDate" DATE,
    "expiryDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentDueDate" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,

    CONSTRAINT "DocumentDueDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionTx" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "CommissionStatus" NOT NULL,
    "milestone" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionTx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRate" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "ratePercent" INTEGER NOT NULL,
    "bonusPercent" INTEGER NOT NULL DEFAULT 0,
    "bonusLabel" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CommissionRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentInvoice" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'Issued',

    CONSTRAINT "AgentInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceCase" (
    "id" TEXT NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "subjectName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "status" "ComplianceStatus" NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" TEXT[],

    CONSTRAINT "ComplianceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogRecord" (
    "id" TEXT NOT NULL,
    "type" "CatalogRecordType" NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "verificationDate" DATE NOT NULL,
    "status" "CatalogRecordStatus" NOT NULL,
    "owner" TEXT NOT NULL,

    CONSTRAINT "CatalogRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "stages" INTEGER NOT NULL,
    "status" "WorkflowTemplateStatus" NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementRule" (
    "id" TEXT NOT NULL,
    "countryId" TEXT,
    "universityId" TEXT,
    "courseId" TEXT,
    "stageType" "StageType" NOT NULL,
    "requirementType" "RequirementType" NOT NULL,
    "name" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL,
    "configuration" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RequirementRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "custom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "tags" TEXT[],
    "subjects" TEXT[],
    "intakes" TEXT[],
    "worldRank" TEXT NOT NULL,
    "employability" TEXT NOT NULL,
    "studentCount" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "highlights" TEXT[],
    "campuses" JSONB,
    "requirements" TEXT[],
    "fees" JSONB NOT NULL,
    "minimumDepositAmount" DOUBLE PRECISION,
    "depositMode" "DepositMode",
    "paymentDeadline" TEXT,
    "depositRules" TEXT[],
    "currencySymbol" TEXT NOT NULL,
    "minIELTS" DOUBLE PRECISION NOT NULL,
    "minGPA" DOUBLE PRECISION NOT NULL,
    "englishRequirements" JSONB,
    "accreditations" TEXT[],
    "scholarshipsAvailable" BOOLEAN NOT NULL,
    "scholarships" JSONB,
    "openIntake" TEXT NOT NULL,
    "intakeStatus" JSONB,
    "intakeDates" JSONB,
    "website" TEXT NOT NULL,
    "tone" "UniversityTone" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "feeUSD" DOUBLE PRECISION NOT NULL,
    "intakes" TEXT[],
    "applicationDeadline" TEXT,
    "requirements" TEXT[],
    "englishRequirements" JSONB,
    "scholarshipAvailable" BOOLEAN,
    "scholarshipInfo" TEXT,
    "currencySymbol" TEXT,
    "campusId" TEXT,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadFollowUp" (
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadFollowUp_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "ProfileStepCompletion" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProfileStepCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamLead" (
    "role" "Role" NOT NULL,
    "staffId" TEXT NOT NULL,

    CONSTRAINT "TeamLead_pkey" PRIMARY KEY ("role")
);

-- CreateTable
CREATE TABLE "StaffNote" (
    "studentId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffNote_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "StaffStatsSnapshot" (
    "namespace" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "values" JSONB NOT NULL,

    CONSTRAINT "StaffStatsSnapshot_pkey" PRIMARY KEY ("namespace")
);

-- CreateTable
CREATE TABLE "CounsellorSettings" (
    "staffId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "taskReminders" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CounsellorSettings_pkey" PRIMARY KEY ("staffId")
);

-- CreateTable
CREATE TABLE "CounsellorSeenApplication" (
    "staffId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CounsellorSeenApplication_pkey" PRIMARY KEY ("staffId","applicationId")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "studentId" TEXT,
    "action" "MeetingAction" NOT NULL,
    "kind" "MeetingKind" NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "studentId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "dob" TEXT,
    "gender" TEXT,
    "nationality" TEXT,
    "fatherName" TEXT,
    "motherName" TEXT,
    "maritalStatus" TEXT,
    "passportNumber" TEXT,
    "personalNumber" TEXT,
    "previousPassportNumber" TEXT,
    "placeOfBirth" TEXT,
    "issuingAuthority" TEXT,
    "issueDate" TEXT,
    "passportExpiry" TEXT,
    "permanentAddress" TEXT,
    "presentAddress" TEXT,
    "city" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactRelationship" TEXT,
    "emergencyContactAddress" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactEmail" TEXT,
    "destinations" TEXT[],
    "studyLevel" TEXT,
    "fields" TEXT[],
    "intake" TEXT,
    "budget" TEXT,
    "accommodation" TEXT,
    "scholarshipInterest" BOOLEAN,
    "emailUpdates" BOOLEAN,
    "smsUpdates" BOOLEAN,
    "whatsappUpdates" BOOLEAN,
    "pushUpdates" BOOLEAN,
    "contactLanguage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "StudentEnglishTest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "overallScore" TEXT NOT NULL,
    "listening" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "writing" TEXT NOT NULL,
    "speaking" TEXT NOT NULL,
    "testDate" TEXT NOT NULL,
    "expiryDate" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "issuingInstitution" TEXT NOT NULL,

    CONSTRAINT "StudentEnglishTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentWorkExperience" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "currentlyWorking" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "StudentWorkExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAcademicLevel" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "board" TEXT,
    "group" TEXT,
    "major" TEXT,
    "grade" TEXT,
    "passingYear" TEXT,

    CONSTRAINT "StudentAcademicLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shortlist" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "universityName" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "addedByRole" "Role" NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shortlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationNextStep" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" DATE,

    CONSTRAINT "ApplicationNextStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE INDEX "Staff_role_idx" ON "Staff"("role");

-- CreateIndex
CREATE INDEX "Application_studentId_idx" ON "Application"("studentId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationJourney_applicationId_key" ON "ApplicationJourney"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationStatusHistory_applicationId_changedAt_idx" ON "ApplicationStatusHistory"("applicationId", "changedAt");

-- CreateIndex
CREATE INDEX "ApplicationActivity_applicationId_timestamp_idx" ON "ApplicationActivity"("applicationId", "timestamp");

-- CreateIndex
CREATE INDEX "Task_assignedToId_assignedToRole_idx" ON "Task"("assignedToId", "assignedToRole");

-- CreateIndex
CREATE INDEX "Task_applicationId_idx" ON "Task"("applicationId");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_applicationId_stageType_idx" ON "Document"("applicationId", "stageType");

-- CreateIndex
CREATE INDEX "Document_studentId_idx" ON "Document"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentDueDate_applicationId_docType_key" ON "DocumentDueDate"("applicationId", "docType");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRate_universityId_key" ON "CommissionRate"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRead_userId_notificationId_key" ON "NotificationRead"("userId", "notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileStepCompletion_studentId_stepKey_key" ON "ProfileStepCompletion"("studentId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "TeamLead_staffId_key" ON "TeamLead"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Shortlist_studentId_universityId_courseName_key" ON "Shortlist"("studentId", "universityId", "courseName");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_counsellorId_fkey" FOREIGN KEY ("counsellorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_responsibleCounsellorId_fkey" FOREIGN KEY ("responsibleCounsellorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_responsibleAdmissionOfficerId_fkey" FOREIGN KEY ("responsibleAdmissionOfficerId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationJourney" ADD CONSTRAINT "ApplicationJourney_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationActivity" ADD CONSTRAINT "ApplicationActivity_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDueDate" ADD CONSTRAINT "DocumentDueDate_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionTx" ADD CONSTRAINT "CommissionTx_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInvoice" ADD CONSTRAINT "AgentInvoice_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "AgentInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationNextStep" ADD CONSTRAINT "ApplicationNextStep_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
