/*
  Warnings:

  - You are about to drop the `StaffNote` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "StaffNote";

-- CreateTable
CREATE TABLE "StudentComment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "performedByRole" "Role" NOT NULL,
    "performedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentComment_studentId_createdAt_idx" ON "StudentComment"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentComment" ADD CONSTRAINT "StudentComment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
