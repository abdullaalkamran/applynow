-- Subject: subject-level default career outcomes (pairs with `modules`).
ALTER TABLE "Subject" ADD COLUMN "careers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Course: multiple campuses instead of one, plus the course-page content fields.
ALTER TABLE "Course" ADD COLUMN "campusIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Course" ADD COLUMN "description" TEXT;
ALTER TABLE "Course" ADD COLUMN "studyMode" TEXT;
ALTER TABLE "Course" ADD COLUMN "modules" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Course" ADD COLUMN "careers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Carry the old single campus over before dropping it.
UPDATE "Course" SET "campusIds" = ARRAY["campusId"] WHERE "campusId" IS NOT NULL AND "campusId" <> '';
ALTER TABLE "Course" DROP COLUMN "campusId";
