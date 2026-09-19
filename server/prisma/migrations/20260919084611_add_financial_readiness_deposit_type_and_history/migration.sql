-- AlterTable
ALTER TABLE "StudentFinancialReadiness" ADD COLUMN     "depositType" TEXT;

-- CreateTable
CREATE TABLE "StudentFinancialReadinessHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT NOT NULL,
    "changedByRole" TEXT NOT NULL,
    "changedByName" TEXT NOT NULL,
    "changes" JSONB NOT NULL,

    CONSTRAINT "StudentFinancialReadinessHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentFinancialReadinessHistory_studentId_changedAt_idx" ON "StudentFinancialReadinessHistory"("studentId", "changedAt");

-- AddForeignKey
ALTER TABLE "StudentFinancialReadinessHistory" ADD CONSTRAINT "StudentFinancialReadinessHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentFinancialReadiness"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;
