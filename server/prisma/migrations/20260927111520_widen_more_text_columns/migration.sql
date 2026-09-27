-- AlterTable
ALTER TABLE `ApplicationActivity` MODIFY `notes` TEXT NULL;

-- AlterTable
ALTER TABLE `CourseImportItem` MODIFY `pageText` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `InterviewAnswer` MODIFY `answerText` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `Message` MODIFY `text` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `Notification` MODIFY `body` TEXT NULL;

-- AlterTable
ALTER TABLE `StudentComment` MODIFY `notes` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `StudentWorkExperience` MODIFY `description` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `Subject` MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `Task` MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `UniversityImportItem` MODIFY `pageText` LONGTEXT NULL;

