-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin') NOT NULL,
    `roleUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Student` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NULL,
    `counsellorId` VARCHAR(191) NULL,
    `avatarColor` VARCHAR(191) NOT NULL,
    `riskFlag` ENUM('none', 'watch', 'high') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Student_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Staff` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `role` ENUM('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin') NOT NULL,
    `status` ENUM('Active', 'Invited', 'Inactive') NOT NULL DEFAULT 'Active',
    `organization` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `avatarColor` VARCHAR(191) NOT NULL,
    `referralCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Staff_email_key`(`email`),
    UNIQUE INDEX `Staff_referralCode_key`(`referralCode`),
    INDEX `Staff_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Application` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `university` VARCHAR(191) NOT NULL,
    `course` VARCHAR(191) NOT NULL,
    `intake` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `campus` VARCHAR(191) NULL,
    `status` ENUM('Draft', 'Profile Incomplete', 'Documents Pending', 'Ready for Review', 'Eligibility Review', 'Application Preparing', 'Ready to Submit', 'Submitted', 'University Review', 'Additional Documents Requested', 'Offer Received', 'Offer Conditions Pending', 'Deposit Pending', 'Deposit Paid', 'CAS/COE Pending', 'CAS/COE Issued', 'Visa Preparation', 'Visa Submitted', 'Visa Decision', 'Enrolled', 'Deferred', 'Withdrawn', 'Rejected', 'Compliance Hold') NOT NULL,
    `progress` INTEGER NOT NULL,
    `nextAction` VARCHAR(191) NOT NULL,
    `waitingOn` ENUM('student', 'staff', 'university', 'none') NOT NULL,
    `stages` JSON NOT NULL,
    `source` ENUM('student', 'counsellor') NULL,
    `responsibleCounsellorId` VARCHAR(191) NULL,
    `responsibleAdmissionOfficerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Application_studentId_idx`(`studentId`),
    INDEX `Application_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationJourney` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `stages` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ApplicationJourney_applicationId_key`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationStatusHistory` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `status` ENUM('Draft', 'Profile Incomplete', 'Documents Pending', 'Ready for Review', 'Eligibility Review', 'Application Preparing', 'Ready to Submit', 'Submitted', 'University Review', 'Additional Documents Requested', 'Offer Received', 'Offer Conditions Pending', 'Deposit Pending', 'Deposit Paid', 'CAS/COE Pending', 'CAS/COE Issued', 'Visa Preparation', 'Visa Submitted', 'Visa Decision', 'Enrolled', 'Deferred', 'Withdrawn', 'Rejected', 'Compliance Hold') NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApplicationStatusHistory_applicationId_changedAt_idx`(`applicationId`, `changedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationActivity` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `stageType` ENUM('application', 'offer', 'financial_readiness', 'payment', 'interview', 'university_document', 'visa', 'evisa', 'enrolment') NULL,
    `action` VARCHAR(191) NOT NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `notes` VARCHAR(191) NULL,
    `performedById` VARCHAR(191) NOT NULL,
    `performedByRole` ENUM('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin') NOT NULL,
    `performedByName` VARCHAR(191) NOT NULL,

    INDEX `ApplicationActivity_applicationId_timestamp_idx`(`applicationId`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `assignedToId` VARCHAR(191) NOT NULL,
    `assignedToRole` ENUM('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin') NOT NULL,
    `assignedToName` VARCHAR(191) NOT NULL,
    `assignedById` VARCHAR(191) NOT NULL,
    `assignedByRole` ENUM('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin') NOT NULL,
    `assignedByName` VARCHAR(191) NOT NULL,
    `dueDate` DATE NULL,
    `done` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `studentId` VARCHAR(191) NULL,
    `studentName` VARCHAR(191) NULL,
    `applicationId` VARCHAR(191) NULL,
    `stageType` ENUM('application', 'offer', 'financial_readiness', 'payment', 'interview', 'university_document', 'visa', 'evisa', 'enrolment') NULL,
    `taskType` VARCHAR(191) NULL,
    `priority` ENUM('low', 'medium', 'high') NULL,
    `externalOwner` VARCHAR(191) NULL,

    INDEX `Task_assignedToId_assignedToRole_idx`(`assignedToId`, `assignedToRole`),
    INDEX `Task_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `fromId` VARCHAR(191) NOT NULL,
    `fromRole` ENUM('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin') NOT NULL,
    `fromName` VARCHAR(191) NOT NULL,
    `toId` VARCHAR(191) NOT NULL,
    `toRole` ENUM('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin') NOT NULL,
    `toName` VARCHAR(191) NOT NULL,
    `text` VARCHAR(191) NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_threadId_createdAt_idx`(`threadId`, `createdAt`),
    INDEX `Message_toId_toRole_read_idx`(`toId`, `toRole`, `read`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NULL,
    `stageType` ENUM('application', 'offer', 'financial_readiness', 'payment', 'interview', 'university_document', 'visa', 'evisa', 'enrolment') NULL,
    `scope` ENUM('core', 'application', 'stage') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'requested', 'uploaded', 'under_review', 'verified', 'rejected', 'flagged', 'expired') NOT NULL DEFAULT 'pending',
    `fileUrl` VARCHAR(191) NULL,
    `custom` BOOLEAN NOT NULL DEFAULT false,
    `note` VARCHAR(191) NULL,
    `rejectionReason` VARCHAR(191) NULL,
    `issuedDate` DATE NULL,
    `expiryDate` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Document_applicationId_stageType_idx`(`applicationId`, `stageType`),
    INDEX `Document_studentId_idx`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentDueDate` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `docType` VARCHAR(191) NOT NULL,
    `dueDate` DATE NOT NULL,

    UNIQUE INDEX `DocumentDueDate_applicationId_docType_key`(`applicationId`, `docType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommissionTx` (
    `id` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `university` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `status` ENUM('NotEligible', 'Expected', 'Pending', 'Approved', 'Invoiced', 'Paid', 'Disputed', 'ClawedBack') NOT NULL,
    `milestone` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommissionRate` (
    `id` VARCHAR(191) NOT NULL,
    `universityId` VARCHAR(191) NOT NULL,
    `mode` VARCHAR(191) NOT NULL DEFAULT 'percent',
    `ratePercent` DOUBLE NOT NULL DEFAULT 0,
    `fixedAmountUSD` DOUBLE NOT NULL DEFAULT 0,
    `bonusPercent` DOUBLE NOT NULL DEFAULT 0,
    `bonusLabel` VARCHAR(191) NOT NULL DEFAULT '',
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CommissionRate_universityId_key`(`universityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentInvoice` (
    `id` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `totalAmount` DOUBLE NOT NULL,
    `status` ENUM('Issued', 'Paid') NOT NULL DEFAULT 'Issued',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceLine` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `studentName` VARCHAR(191) NOT NULL,
    `university` VARCHAR(191) NOT NULL,
    `course` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplianceCase` (
    `id` VARCHAR(191) NOT NULL,
    `subjectType` ENUM('Student', 'Agent', 'Document', 'Application') NOT NULL,
    `subjectName` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `riskLevel` ENUM('low', 'medium', 'high') NOT NULL,
    `status` ENUM('Open', 'Investigating', 'Frozen', 'Cleared', 'Escalated') NOT NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `evidence` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CatalogRecord` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('University', 'Course', 'Intake', 'Requirement', 'Scholarship') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `effectiveDate` DATE NOT NULL,
    `verificationDate` DATE NOT NULL,
    `status` ENUM('Draft', 'InReview', 'Published', 'Stale') NOT NULL,
    `owner` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `stages` INTEGER NOT NULL,
    `status` ENUM('Active', 'Draft', 'Archived') NOT NULL,
    `lastUpdated` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLogEntry` (
    `id` VARCHAR(191) NOT NULL,
    `actor` VARCHAR(191) NOT NULL,
    `role` ENUM('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin') NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RequirementRule` (
    `id` VARCHAR(191) NOT NULL,
    `countryId` VARCHAR(191) NULL,
    `universityId` VARCHAR(191) NULL,
    `courseId` VARCHAR(191) NULL,
    `stageType` ENUM('application', 'offer', 'financial_readiness', 'payment', 'interview', 'university_document', 'visa', 'evisa', 'enrolment') NOT NULL,
    `requirementType` ENUM('document', 'financial_holding_period', 'immigration_document_type') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL,
    `configuration` JSON NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Country` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Country_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subject` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `custom` BOOLEAN NOT NULL DEFAULT false,
    `description` VARCHAR(191) NULL,
    `modules` JSON NOT NULL,
    `careers` JSON NOT NULL,
    `accreditations` JSON NOT NULL,
    `disciplineArea` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subject_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `University` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `tags` JSON NOT NULL,
    `subjects` JSON NOT NULL,
    `intakes` JSON NOT NULL,
    `worldRank` VARCHAR(191) NOT NULL,
    `qsRanking` VARCHAR(191) NULL,
    `timesHigherRanking` VARCHAR(191) NULL,
    `employability` VARCHAR(191) NOT NULL,
    `studentCount` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `highlights` JSON NOT NULL,
    `campuses` JSON NULL,
    `requirements` JSON NOT NULL,
    `fees` JSON NOT NULL,
    `minimumDepositAmount` DOUBLE NULL,
    `depositMode` ENUM('custom', 'half', 'full') NULL,
    `paymentDeadline` VARCHAR(191) NULL,
    `depositRules` JSON NOT NULL,
    `admissionSteps` JSON NOT NULL,
    `restrictedRegions` JSON NOT NULL,
    `state` VARCHAR(191) NULL,
    `eslElpAvailable` BOOLEAN NULL,
    `applicationFeeWaiverAvailable` BOOLEAN NULL,
    `applicationFeeWaiverPercent` INTEGER NULL,
    `currencySymbol` VARCHAR(191) NOT NULL,
    `minIELTS` DOUBLE NOT NULL,
    `minGPA` DOUBLE NOT NULL,
    `englishRequirements` JSON NULL,
    `moiAccepted` BOOLEAN NULL,
    `moiAcceptedUniversities` JSON NOT NULL,
    `internalEnglishTestOffered` BOOLEAN NULL,
    `internalEnglishTestFree` BOOLEAN NULL,
    `internalEnglishTestFee` DOUBLE NULL,
    `accreditations` JSON NOT NULL,
    `scholarshipsAvailable` BOOLEAN NOT NULL,
    `scholarships` JSON NULL,
    `openIntake` VARCHAR(191) NOT NULL,
    `intakeStatus` JSON NULL,
    `intakeDates` JSON NULL,
    `website` VARCHAR(191) NOT NULL,
    `tone` ENUM('violet', 'amber', 'teal', 'rose') NOT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `coverPhotoUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Course` (
    `id` VARCHAR(191) NOT NULL,
    `universityId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `duration` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `feeUSD` DOUBLE NOT NULL,
    `intakes` JSON NOT NULL,
    `applicationDeadline` VARCHAR(191) NULL,
    `requirements` JSON NOT NULL,
    `englishRequirements` JSON NULL,
    `currencySymbol` VARCHAR(191) NULL,
    `campusIds` JSON NOT NULL,
    `description` VARCHAR(191) NULL,
    `studyMode` VARCHAR(191) NULL,
    `modules` JSON NOT NULL,
    `careers` JSON NOT NULL,
    `accreditations` JSON NULL,
    `standardizedTests` JSON NOT NULL,
    `programLevel` JSON NOT NULL,
    `mathsRequired` BOOLEAN NOT NULL DEFAULT true,
    `isStemProgram` BOOLEAN NOT NULL DEFAULT false,
    `accepts15YearsEducation` BOOLEAN NOT NULL DEFAULT false,

    INDEX `Course_universityId_idx`(`universityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseImportItem` (
    `id` VARCHAR(191) NOT NULL,
    `universityId` VARCHAR(191) NOT NULL,
    `sourceUrl` VARCHAR(191) NOT NULL,
    `status` ENUM('queued', 'running', 'needs_review', 'approved', 'discarded', 'failed') NOT NULL DEFAULT 'queued',
    `textSource` VARCHAR(191) NULL,
    `pageText` VARCHAR(191) NULL,
    `extracted` JSON NULL,
    `error` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `approvedCourseId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CourseImportItem_universityId_createdAt_idx`(`universityId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `userRole` ENUM('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin') NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `applicationId` VARCHAR(191) NULL,
    `activityId` VARCHAR(191) NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_userRole_createdAt_idx`(`userId`, `userRole`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadFollowUp` (
    `studentId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`studentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProfileStepCompletion` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `stepKey` VARCHAR(191) NOT NULL,
    `complete` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ProfileStepCompletion_studentId_stepKey_key`(`studentId`, `stepKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamLead` (
    `role` ENUM('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin') NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `TeamLead_staffId_key`(`staffId`),
    PRIMARY KEY (`role`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentComment` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NOT NULL,
    `performedById` VARCHAR(191) NOT NULL,
    `performedByRole` ENUM('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin') NOT NULL,
    `performedByName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StudentComment_studentId_createdAt_idx`(`studentId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffStatsSnapshot` (
    `namespace` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `values` JSON NOT NULL,

    PRIMARY KEY (`namespace`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CounsellorSettings` (
    `staffId` VARCHAR(191) NOT NULL,
    `emailNotifications` BOOLEAN NOT NULL DEFAULT true,
    `taskReminders` BOOLEAN NOT NULL DEFAULT true,
    `weeklyDigest` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`staffId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CounsellorSeenApplication` (
    `staffId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `seenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`staffId`, `applicationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Meeting` (
    `id` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `time` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `subtitle` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NULL,
    `action` ENUM('Join', 'Email', 'Prepare', 'View') NOT NULL,
    `kind` ENUM('session', 'task') NOT NULL,
    `done` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentProfile` (
    `studentId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `dob` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `nationality` VARCHAR(191) NULL,
    `fatherName` VARCHAR(191) NULL,
    `motherName` VARCHAR(191) NULL,
    `maritalStatus` VARCHAR(191) NULL,
    `passportNumber` VARCHAR(191) NULL,
    `personalNumber` VARCHAR(191) NULL,
    `previousPassportNumber` VARCHAR(191) NULL,
    `placeOfBirth` VARCHAR(191) NULL,
    `issuingAuthority` VARCHAR(191) NULL,
    `issueDate` VARCHAR(191) NULL,
    `passportExpiry` VARCHAR(191) NULL,
    `permanentAddress` VARCHAR(191) NULL,
    `presentAddress` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `emergencyContactName` VARCHAR(191) NULL,
    `emergencyContactRelationship` VARCHAR(191) NULL,
    `emergencyContactAddress` VARCHAR(191) NULL,
    `emergencyContactPhone` VARCHAR(191) NULL,
    `emergencyContactEmail` VARCHAR(191) NULL,
    `destinations` JSON NOT NULL,
    `studyLevel` VARCHAR(191) NULL,
    `fields` JSON NOT NULL,
    `intake` VARCHAR(191) NULL,
    `budget` VARCHAR(191) NULL,
    `accommodation` VARCHAR(191) NULL,
    `scholarshipInterest` BOOLEAN NULL,
    `emailUpdates` BOOLEAN NULL,
    `smsUpdates` BOOLEAN NULL,
    `whatsappUpdates` BOOLEAN NULL,
    `pushUpdates` BOOLEAN NULL,
    `contactLanguage` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`studentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentEnglishTest` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `testName` VARCHAR(191) NOT NULL,
    `testType` VARCHAR(191) NOT NULL,
    `overallScore` VARCHAR(191) NOT NULL,
    `listening` VARCHAR(191) NOT NULL,
    `reading` VARCHAR(191) NOT NULL,
    `writing` VARCHAR(191) NOT NULL,
    `speaking` VARCHAR(191) NOT NULL,
    `testDate` VARCHAR(191) NOT NULL,
    `expiryDate` VARCHAR(191) NOT NULL,
    `reportNumber` VARCHAR(191) NOT NULL,
    `issuingInstitution` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentWorkExperience` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `company` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `industry` VARCHAR(191) NOT NULL,
    `startDate` VARCHAR(191) NOT NULL,
    `endDate` VARCHAR(191) NULL,
    `currentlyWorking` BOOLEAN NOT NULL,
    `description` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentAcademicLevel` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `orderIndex` INTEGER NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `institution` VARCHAR(191) NOT NULL,
    `board` VARCHAR(191) NULL,
    `group` VARCHAR(191) NULL,
    `major` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `passingYear` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentFinancialReadiness` (
    `studentId` VARCHAR(191) NOT NULL,
    `evidenceRequired` BOOLEAN NOT NULL DEFAULT true,
    `requiredAmount` DOUBLE NULL,
    `currency` VARCHAR(191) NULL,
    `holdingPeriodDays` INTEGER NULL,
    `openingDate` DATE NULL,
    `maturityDate` DATE NULL,
    `bankStatus` VARCHAR(191) NOT NULL DEFAULT 'Not Started',
    `bankName` VARCHAR(191) NULL,
    `accountHolder` VARCHAR(191) NULL,
    `accountType` VARCHAR(191) NULL,
    `depositType` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`studentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentFinancialReadinessHistory` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `changedById` VARCHAR(191) NOT NULL,
    `changedByRole` VARCHAR(191) NOT NULL,
    `changedByName` VARCHAR(191) NOT NULL,
    `changes` JSON NOT NULL,

    INDEX `StudentFinancialReadinessHistory_studentId_changedAt_idx`(`studentId`, `changedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shortlist` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `universityId` VARCHAR(191) NOT NULL,
    `universityName` VARCHAR(191) NOT NULL,
    `courseName` VARCHAR(191) NOT NULL,
    `addedByRole` ENUM('student', 'agent', 'counsellor', 'admission', 'compliance', 'data', 'finance', 'admin') NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Shortlist_studentId_universityId_courseName_key`(`studentId`, `universityId`, `courseName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationNextStep` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `done` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `dueDate` DATE NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InterviewQuestionSet` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InterviewQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `questionSetId` VARCHAR(191) NOT NULL,
    `prompt` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,

    INDEX `InterviewQuestion_questionSetId_orderIndex_idx`(`questionSetId`, `orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InterviewSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questionSetId` VARCHAR(191) NOT NULL,
    `status` ENUM('in_progress', 'completed') NOT NULL DEFAULT 'in_progress',
    `overallScore` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InterviewSession_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InterviewAnswer` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `answerText` VARCHAR(191) NOT NULL,
    `scores` JSON NOT NULL,
    `feedback` JSON NOT NULL,
    `overall` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InterviewAnswer_sessionId_idx`(`sessionId`),
    UNIQUE INDEX `InterviewAnswer_sessionId_questionId_key`(`sessionId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UniversityImportItem` (
    `id` VARCHAR(191) NOT NULL,
    `sourceUrl` VARCHAR(191) NOT NULL,
    `extraUrls` JSON NOT NULL,
    `status` ENUM('queued', 'running', 'needs_review', 'approved', 'discarded', 'failed') NOT NULL DEFAULT 'queued',
    `countryHint` VARCHAR(191) NULL,
    `textSource` VARCHAR(191) NULL,
    `pageText` VARCHAR(191) NULL,
    `extracted` JSON NULL,
    `error` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `approvedUniversityId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UniversityImportItem_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_counsellorId_fkey` FOREIGN KEY (`counsellorId`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_responsibleCounsellorId_fkey` FOREIGN KEY (`responsibleCounsellorId`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_responsibleAdmissionOfficerId_fkey` FOREIGN KEY (`responsibleAdmissionOfficerId`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationJourney` ADD CONSTRAINT `ApplicationJourney_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationStatusHistory` ADD CONSTRAINT `ApplicationStatusHistory_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationActivity` ADD CONSTRAINT `ApplicationActivity_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentDueDate` ADD CONSTRAINT `DocumentDueDate_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommissionTx` ADD CONSTRAINT `CommissionTx_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentInvoice` ADD CONSTRAINT `AgentInvoice_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `AgentInvoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Course` ADD CONSTRAINT `Course_universityId_fkey` FOREIGN KEY (`universityId`) REFERENCES `University`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseImportItem` ADD CONSTRAINT `CourseImportItem_universityId_fkey` FOREIGN KEY (`universityId`) REFERENCES `University`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentComment` ADD CONSTRAINT `StudentComment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentFinancialReadiness` ADD CONSTRAINT `StudentFinancialReadiness_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentFinancialReadinessHistory` ADD CONSTRAINT `StudentFinancialReadinessHistory_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentFinancialReadiness`(`studentId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationNextStep` ADD CONSTRAINT `ApplicationNextStep_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InterviewQuestion` ADD CONSTRAINT `InterviewQuestion_questionSetId_fkey` FOREIGN KEY (`questionSetId`) REFERENCES `InterviewQuestionSet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InterviewSession` ADD CONSTRAINT `InterviewSession_questionSetId_fkey` FOREIGN KEY (`questionSetId`) REFERENCES `InterviewQuestionSet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InterviewAnswer` ADD CONSTRAINT `InterviewAnswer_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `InterviewSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InterviewAnswer` ADD CONSTRAINT `InterviewAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `InterviewQuestion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

