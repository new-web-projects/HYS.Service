-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "purpose" TEXT;

-- CreateIndex
CREATE INDEX "Media_uploadedById_purpose_idx" ON "Media"("uploadedById", "purpose");
