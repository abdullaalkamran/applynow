-- BlogPost SEO fields: search title, quick answer, cover alt text, category, countries, sources, earlier slugs (for 301
-- redirects) and the FAQ detected in the text.
--
-- Purely additive: new nullable columns, nothing existing is touched.
--
-- Rollback (if ever needed): ALTER TABLE `BlogPost` DROP COLUMN `seoTitle`, DROP COLUMN `quickAnswer`, DROP COLUMN `coverAlt`,
--   DROP COLUMN `category`, DROP COLUMN `countries`, DROP COLUMN `sources`, DROP COLUMN `oldSlugs`, DROP COLUMN `faqJson`;

-- AlterTable
ALTER TABLE `BlogPost` ADD COLUMN `seoTitle` VARCHAR(191) NULL,
    ADD COLUMN `quickAnswer` TEXT NULL,
    ADD COLUMN `coverAlt` VARCHAR(191) NULL,
    ADD COLUMN `category` VARCHAR(191) NULL,
    ADD COLUMN `countries` JSON NULL,
    ADD COLUMN `sources` JSON NULL,
    ADD COLUMN `oldSlugs` JSON NULL,
    ADD COLUMN `faqJson` JSON NULL;
