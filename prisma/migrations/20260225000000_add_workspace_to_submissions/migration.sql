-- AlterTable
ALTER TABLE "content_submissions" ADD COLUMN "workspaceId" TEXT;

-- CreateIndex
CREATE INDEX "content_submissions_workspaceId_idx" ON "content_submissions"("workspaceId");

-- AddForeignKey
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
