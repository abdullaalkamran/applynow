-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "referralCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Staff_referralCode_key" ON "Staff"("referralCode");
