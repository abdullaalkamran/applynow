/*
  Warnings:

  - You are about to drop the `NotificationRead` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "NotificationRead";

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" "Role" NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "applicationId" TEXT,
    "activityId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_userRole_createdAt_idx" ON "Notification"("userId", "userRole", "createdAt");
