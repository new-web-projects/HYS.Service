-- CreateEnum
CREATE TYPE "Role" AS ENUM ('superadmin', 'editor');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'editor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaDescription" TEXT,
    "sectionsJson" JSONB NOT NULL DEFAULT '[]',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "siteName" TEXT NOT NULL DEFAULT 'My Site',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "socialLinksJson" JSONB NOT NULL DEFAULT '{}',
    "contactEmail" TEXT,
    "footerText" TEXT,
    "razorpayKeyId" TEXT NOT NULL DEFAULT '',
    "razorpayKeySecret" TEXT NOT NULL DEFAULT '',
    "razorpayMerchantName" TEXT NOT NULL DEFAULT '',
    "razorpaySupportEmail" TEXT NOT NULL DEFAULT '',
    "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "platformFeeType" TEXT NOT NULL DEFAULT 'percent',
    "platformFixed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "gstModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "withdrawalFee" DOUBLE PRECISION NOT NULL DEFAULT 11,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT NOT NULL DEFAULT 'We are performing scheduled maintenance. Please check back soon.',
    "estimatedReturn" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT '🔧',
    "status" TEXT NOT NULL DEFAULT 'active',
    "submittedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "errorType" TEXT NOT NULL DEFAULT 'Error',
    "message" TEXT NOT NULL,
    "stackTrace" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT 'unknown',
    "route" TEXT NOT NULL DEFAULT '/',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL DEFAULT 'anonymous',
    "role" TEXT NOT NULL DEFAULT 'unknown',
    "browser" TEXT NOT NULL DEFAULT 'unknown',
    "device" TEXT NOT NULL DEFAULT 'unknown',
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "errorCode" TEXT NOT NULL DEFAULT '',
    "viewport" TEXT NOT NULL DEFAULT '?',
    "fn" TEXT NOT NULL DEFAULT 'unknown',
    "line" TEXT NOT NULL DEFAULT '?',

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorReport" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Error',
    "code" TEXT NOT NULL DEFAULT '',
    "stack" TEXT NOT NULL,
    "file" TEXT NOT NULL DEFAULT 'unknown',
    "line" TEXT NOT NULL DEFAULT '?',
    "fn" TEXT NOT NULL DEFAULT 'unknown',
    "componentStack" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "route" TEXT NOT NULL DEFAULT '/',
    "browser" TEXT NOT NULL DEFAULT 'unknown',
    "device" TEXT NOT NULL DEFAULT 'unknown',
    "screen" TEXT NOT NULL DEFAULT '?',
    "viewport" TEXT NOT NULL DEFAULT '?',
    "userId" TEXT NOT NULL DEFAULT 'anonymous',
    "role" TEXT NOT NULL DEFAULT 'unknown',
    "errorOccurredAt" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT NOT NULL DEFAULT '',
    "assignee" TEXT,

    CONSTRAINT "ErrorReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "ErrorLog_errorType_timestamp_idx" ON "ErrorLog"("errorType", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "ErrorLog_route_timestamp_idx" ON "ErrorLog"("route", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "ErrorLog_userId_timestamp_idx" ON "ErrorLog"("userId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "ErrorLog_role_timestamp_idx" ON "ErrorLog"("role", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "ErrorReport_status_reportedAt_idx" ON "ErrorReport"("status", "reportedAt" DESC);

-- CreateIndex
CREATE INDEX "ErrorReport_route_reportedAt_idx" ON "ErrorReport"("route", "reportedAt" DESC);

-- CreateIndex
CREATE INDEX "ErrorReport_role_reportedAt_idx" ON "ErrorReport"("role", "reportedAt" DESC);

-- CreateIndex
CREATE INDEX "ErrorReport_userId_reportedAt_idx" ON "ErrorReport"("userId", "reportedAt" DESC);

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
