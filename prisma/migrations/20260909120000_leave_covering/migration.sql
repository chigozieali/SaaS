-- AlterTable
ALTER TABLE "Leave" ADD COLUMN "coveringForId" TEXT;

-- AddForeignKey
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_coveringForId_fkey" FOREIGN KEY ("coveringForId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Leave_coveringForId_idx" ON "Leave"("coveringForId");