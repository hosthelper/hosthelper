-- AlterTable
ALTER TABLE "BuyerLead" ADD COLUMN     "phoneAt" TIMESTAMP(3),
ADD COLUMN     "visitAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BuyerLead_phoneAt_idx" ON "BuyerLead"("phoneAt");

-- CreateIndex
CREATE INDEX "BuyerLead_visitAt_idx" ON "BuyerLead"("visitAt");
