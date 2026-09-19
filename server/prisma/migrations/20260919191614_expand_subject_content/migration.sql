/*
  Warnings:

  - Added the required column `updatedAt` to the `Subject` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "accreditations" TEXT[],
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "modules" TEXT[],
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
