-- CreateTable
CREATE TABLE `StudentBankAccount` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `bankName` VARCHAR(191) NOT NULL,
    `depositType` VARCHAR(191) NULL,
    `openingDate` DATE NULL,
    `amount` DOUBLE NULL,
    `currency` VARCHAR(191) NULL,
    `accountHolder` VARCHAR(191) NULL,
    `accountType` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Not Started',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StudentBankAccount_studentId_idx`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Carry every existing single-bank record over as that student's first account.
INSERT INTO `StudentBankAccount` (`id`, `studentId`, `bankName`, `depositType`, `openingDate`, `amount`, `currency`, `accountHolder`, `accountType`, `status`, `createdAt`, `updatedAt`)
SELECT UUID(), `studentId`, COALESCE(NULLIF(`bankName`, ''), 'Bank account'), `depositType`, `openingDate`, `requiredAmount`, `currency`, `accountHolder`, `accountType`, `bankStatus`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `StudentFinancialReadiness`
WHERE (`bankName` IS NOT NULL AND `bankName` <> '') OR `openingDate` IS NOT NULL OR `requiredAmount` IS NOT NULL;
