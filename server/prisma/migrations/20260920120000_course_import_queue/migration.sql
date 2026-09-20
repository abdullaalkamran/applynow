-- Data Management's AI course-import queue: one row per pasted course-page URL. Nothing here is a
-- Course until a staff member approves the row.
CREATE TYPE "CourseImportStatus" AS ENUM ('queued', 'running', 'needs_review', 'approved', 'discarded', 'failed');

CREATE TABLE "CourseImportItem" (
  "id" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "status" "CourseImportStatus" NOT NULL DEFAULT 'queued',
  "textSource" TEXT,
  "pageText" TEXT,
  "extracted" JSONB,
  "error" TEXT,
  "createdBy" TEXT NOT NULL,
  "approvedCourseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseImportItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseImportItem_universityId_createdAt_idx" ON "CourseImportItem"("universityId", "createdAt");

ALTER TABLE "CourseImportItem" ADD CONSTRAINT "CourseImportItem_universityId_fkey"
  FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
