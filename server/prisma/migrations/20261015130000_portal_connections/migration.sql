-- CreateTable
CREATE TABLE `PortalConnection` (
    `id` VARCHAR(191) NOT NULL,
    `counsellorId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `universityId` VARCHAR(191) NULL,
    `usernameEnc` TEXT NOT NULL,
    `passwordEnc` TEXT NOT NULL,
    `lastLoginOk` BOOLEAN NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `failedLogins` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PortalConnection_counsellorId_idx`(`counsellorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PortalSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `portalConnectionId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `externalRef` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `lastCheckedAt` DATETIME(3) NULL,
    `snapshot` JSON NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PortalSubmission_portalConnectionId_idx`(`portalConnectionId`),
    UNIQUE INDEX `PortalSubmission_applicationId_portalConnectionId_key`(`applicationId`, `portalConnectionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PortalJob` (
    `id` VARCHAR(191) NOT NULL,
    `submissionId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `log` JSON NULL,
    `screenshot` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PortalJob_status_idx`(`status`),
    INDEX `PortalJob_submissionId_idx`(`submissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PortalAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorType` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `portalConnectionId` VARCHAR(191) NULL,
    `applicationId` VARCHAR(191) NULL,
    `detail` TEXT NULL,

    INDEX `PortalAuditLog_portalConnectionId_idx`(`portalConnectionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
