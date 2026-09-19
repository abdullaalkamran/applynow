-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Message_toId_toRole_read_idx" ON "Message"("toId", "toRole", "read");
