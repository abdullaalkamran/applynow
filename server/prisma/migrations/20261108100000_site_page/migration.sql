-- SitePage: editable public pages (the About page) stored as JSON, edited by Data Management.
--
-- Purely additive: one new table, nothing existing is touched.
--
-- Rollback (if ever needed): DROP TABLE `SitePage`;

-- CreateTable
CREATE TABLE `SitePage` (
    `key` VARCHAR(191) NOT NULL,
    `data` LONGTEXT NOT NULL,
    `updatedBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
