-- CreateEnum
CREATE TYPE "IntegrationRequestType" AS ENUM ('DEMO', 'CONSULTATION', 'PILOT', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "IntegrationRequestStatus" AS ENUM ('NEW', 'IN_REVIEW', 'SENT_TO_UNIVERSITY', 'IN_PROGRESS', 'DONE', 'DECLINED');

-- CreateTable
CREATE TABLE "integration_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT NOT NULL,
    "organization" TEXT,
    "contactPhone" TEXT,
    "type" "IntegrationRequestType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "IntegrationRequestStatus" NOT NULL DEFAULT 'NEW',
    "operatorNote" TEXT,
    "universityNote" TEXT,
    "forwardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_requests_status_createdAt_idx" ON "integration_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "integration_requests_projectId_idx" ON "integration_requests"("projectId");

-- CreateIndex
CREATE INDEX "integration_requests_userId_idx" ON "integration_requests"("userId");

-- AddForeignKey
ALTER TABLE "integration_requests" ADD CONSTRAINT "integration_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_requests" ADD CONSTRAINT "integration_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
