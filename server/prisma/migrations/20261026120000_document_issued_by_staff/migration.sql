-- Document.issuedByStaff: lets staff attach an offer letter, CAS letter or any other named document to an
-- application, visible to the student, agent and everyone responsible for it.
--
-- Purely additive: three new columns with defaults/NULLs. No existing row or column is touched.
--
-- Rollback (if ever needed):
--   ALTER TABLE `Document` DROP COLUMN `issuedByStaff`, DROP COLUMN `uploadedByName`, DROP COLUMN `uploadedByRole`;

-- AlterTable
ALTER TABLE `Document` ADD COLUMN `issuedByStaff` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `uploadedByName` VARCHAR(191) NULL,
    ADD COLUMN `uploadedByRole` VARCHAR(191) NULL;
