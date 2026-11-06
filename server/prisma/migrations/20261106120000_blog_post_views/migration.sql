-- BlogPost.viewCount: how many times a News & Updates post page has been visited (shown only to Data Management).
--
-- Purely additive: one new column with a default, nothing existing is touched.
--
-- Rollback (if ever needed): ALTER TABLE `BlogPost` DROP COLUMN `viewCount`;

-- AlterTable
ALTER TABLE `BlogPost` ADD COLUMN `viewCount` INTEGER NOT NULL DEFAULT 0;
