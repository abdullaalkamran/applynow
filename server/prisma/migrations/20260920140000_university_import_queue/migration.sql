-- University-level AI import queue (see CourseImportItem for the per-course one).
CREATE TABLE "UniversityImportItem" (
  "id" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "status" "CourseImportStatus" NOT NULL DEFAULT 'queued',
  "countryHint" TEXT,
  "textSource" TEXT,
  "pageText" TEXT,
  "extracted" JSONB,
  "error" TEXT,
  "createdBy" TEXT NOT NULL,
  "approvedUniversityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UniversityImportItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UniversityImportItem_createdAt_idx" ON "UniversityImportItem"("createdAt");
