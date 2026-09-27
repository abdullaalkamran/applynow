-- AlterTable
ALTER TABLE `Course` MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `University` MODIFY `description` TEXT NOT NULL,
    MODIFY `logoUrl` LONGTEXT NULL,
    MODIFY `coverPhotoUrl` LONGTEXT NULL;

