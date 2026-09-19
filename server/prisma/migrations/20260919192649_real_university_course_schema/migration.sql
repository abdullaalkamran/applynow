/*
  Warnings:

  - You are about to drop the column `scholarshipAvailable` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `scholarshipInfo` on the `Course` table. All the data in the column will be lost.
  - Changed the type of `requirements` on the `University` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_universityId_fkey";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "scholarshipAvailable",
DROP COLUMN "scholarshipInfo";

-- AlterTable
ALTER TABLE "University" ADD COLUMN     "admissionSteps" TEXT[],
ADD COLUMN     "coverPhotoUrl" TEXT,
ADD COLUMN     "internalEnglishTestFee" DOUBLE PRECISION,
ADD COLUMN     "internalEnglishTestFree" BOOLEAN,
ADD COLUMN     "internalEnglishTestOffered" BOOLEAN,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "moiAccepted" BOOLEAN,
ADD COLUMN     "moiAcceptedUniversities" TEXT[],
ADD COLUMN     "qsRanking" TEXT,
ADD COLUMN     "restrictedRegions" TEXT[],
ADD COLUMN     "timesHigherRanking" TEXT,
DROP COLUMN "requirements",
ADD COLUMN     "requirements" JSONB NOT NULL;

-- CreateIndex
CREATE INDEX "Course_universityId_idx" ON "Course"("universityId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
