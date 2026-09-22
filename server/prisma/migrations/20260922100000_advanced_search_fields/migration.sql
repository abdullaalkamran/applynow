-- Subject: coarser grouping above Subject/"Study Area", backs the "Discipline Area" filter.
ALTER TABLE "Subject" ADD COLUMN "disciplineArea" TEXT;

-- University: own location's state/province, ESL/ELP program offering, application fee waiver.
ALTER TABLE "University" ADD COLUMN "state" TEXT;
ALTER TABLE "University" ADD COLUMN "eslElpAvailable" BOOLEAN;
ALTER TABLE "University" ADD COLUMN "applicationFeeWaiverAvailable" BOOLEAN;
ALTER TABLE "University" ADD COLUMN "applicationFeeWaiverPercent" INTEGER;

-- Course: standardized admission tests (distinct from englishRequirements), and real eligibility
-- flags backing the Advanced Search Requirements checkboxes.
ALTER TABLE "Course" ADD COLUMN "standardizedTests" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Course" ADD COLUMN "mathsRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Course" ADD COLUMN "isStemProgram" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN "accepts15YearsEducation" BOOLEAN NOT NULL DEFAULT false;
