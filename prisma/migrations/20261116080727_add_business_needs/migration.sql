-- CreateEnum
CREATE TYPE "BusinessNeedStatus" AS ENUM ('COLLECTING', 'SENT');

-- AlterTable
ALTER TABLE "integration_requests" ADD COLUMN     "needId" TEXT;

-- CreateTable
CREATE TABLE "business_needs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "BusinessNeedStatus" NOT NULL DEFAULT 'COLLECTING',
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "readiness" INTEGER NOT NULL DEFAULT 0,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "fields" JSONB NOT NULL DEFAULT '[]',
    "snapshots" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_needs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_needs_userId_updatedAt_idx" ON "business_needs"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "integration_requests" ADD CONSTRAINT "integration_requests_needId_fkey" FOREIGN KEY ("needId") REFERENCES "business_needs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_needs" ADD CONSTRAINT "business_needs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
