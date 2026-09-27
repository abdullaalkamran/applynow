-- AlterTable
-- Safe to run on this table specifically: confirmed zero rows in every environment (nothing in the
-- app has ever written to Country before this migration — only ever read via findMany), so the
-- NOT NULL columns below need no default to satisfy existing rows.
ALTER TABLE `Country` ADD COLUMN `applicationProcedure` TEXT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `currencySymbols` JSON NOT NULL,
    ADD COLUMN `internationalStudentStat` VARCHAR(191) NULL,
    ADD COLUMN `keyInfo` JSON NULL,
    ADD COLUMN `logoUrl` LONGTEXT NULL,
    ADD COLUMN `photoUrl` LONGTEXT NULL,
    ADD COLUMN `recommendedFundsUSD` INTEGER NULL,
    ADD COLUMN `requiredDocuments` JSON NOT NULL,
    ADD COLUMN `tagline` VARCHAR(191) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `usefulLinks` JSON NOT NULL,
    ADD COLUMN `visaCostConfig` JSON NULL,
    ADD COLUMN `visaProcedure` TEXT NULL,
    ADD COLUMN `whyStudyHighlights` JSON NOT NULL,
    ADD COLUMN `whyThisCountry` TEXT NULL;

-- Seed the four countries requirementRules.ts references by a fixed id (co-seed-uk, etc.) — these
-- must exist as real rows so getAllCountries()/getCountryByName() (now server-backed) actually
-- return them, matching countryRegistry.ts's SEED_COUNTRIES constant which getCountryId() still
-- special-cases by name so these ids are never re-minted. Idempotent: safe to re-run. The four
-- NOT NULL JSON columns (and updatedAt) need an explicit value since none have a DB-level default.
INSERT IGNORE INTO `Country` (`id`, `name`, `currencySymbols`, `requiredDocuments`, `usefulLinks`, `whyStudyHighlights`, `updatedAt`) VALUES
    ('co-seed-uk', 'UK', '[]', '[]', '[]', '[]', CURRENT_TIMESTAMP(3)),
    ('co-seed-australia', 'Australia', '[]', '[]', '[]', '[]', CURRENT_TIMESTAMP(3)),
    ('co-seed-canada', 'Canada', '[]', '[]', '[]', '[]', CURRENT_TIMESTAMP(3)),
    ('co-seed-united-states', 'United States', '[]', '[]', '[]', '[]', CURRENT_TIMESTAMP(3));

