-- AlterTable
ALTER TABLE "vault_folders" ADD COLUMN "parentId" TEXT;

-- CreateIndex
CREATE INDEX "vault_folders_parentId_idx" ON "vault_folders"("parentId");

-- AddForeignKey
ALTER TABLE "vault_folders" ADD CONSTRAINT "vault_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "vault_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
