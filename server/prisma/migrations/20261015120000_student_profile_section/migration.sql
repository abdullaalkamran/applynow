-- CreateTable
CREATE TABLE `StudentProfileSection` (
    `studentId` VARCHAR(191) NOT NULL,
    `section` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`studentId`, `section`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
