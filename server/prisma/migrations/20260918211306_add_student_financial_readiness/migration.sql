-- CreateTable
CREATE TABLE "StudentFinancialReadiness" (
    "studentId" TEXT NOT NULL,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT true,
    "requiredAmount" DOUBLE PRECISION,
    "currency" TEXT,
    "holdingPeriodDays" INTEGER,
    "openingDate" DATE,
    "maturityDate" DATE,
    "bankStatus" TEXT NOT NULL DEFAULT 'Not Started',
    "accountHolder" TEXT,
    "accountType" TEXT,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFinancialReadiness_pkey" PRIMARY KEY ("studentId")
);

-- AddForeignKey
ALTER TABLE "StudentFinancialReadiness" ADD CONSTRAINT "StudentFinancialReadiness_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
