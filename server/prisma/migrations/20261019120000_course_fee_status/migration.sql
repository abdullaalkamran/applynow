-- Course.feeStatus: tells a real annual fee apart from "free" and from "not provided".
--
-- Purely additive: one new column with a default. No UPDATE, no existing column touched — every course keeps its
-- feeUSD value exactly as saved. All existing rows get 'amount'; the app then reads a legacy 'amount' row with
-- feeUSD = 0 as "Fee not provided" (a 0 was historically saved for unknown fees too), and shows "Free" only for
-- rows explicitly set to 'free'.
--
-- Rollback (if ever needed): ALTER TABLE `Course` DROP COLUMN `feeStatus`;

-- AlterTable
ALTER TABLE `Course` ADD COLUMN `feeStatus` ENUM('amount', 'free', 'unknown') NOT NULL DEFAULT 'amount';
