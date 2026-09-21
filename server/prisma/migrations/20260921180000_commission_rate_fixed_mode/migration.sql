-- Commission rates: allow a fixed USD amount per enrolment as an alternative to a % of tuition,
-- and fractional percentages.
ALTER TABLE "CommissionRate"
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'percent',
  ADD COLUMN "fixedAmountUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "ratePercent" TYPE DOUBLE PRECISION,
  ALTER COLUMN "ratePercent" SET DEFAULT 0,
  ALTER COLUMN "bonusPercent" TYPE DOUBLE PRECISION;
