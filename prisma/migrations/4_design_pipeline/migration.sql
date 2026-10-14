-- CreateEnum
CREATE TYPE "DesignImportKind" AS ENUM ('INSTALL', 'RESYNC');

-- CreateEnum
CREATE TYPE "DesignSystemStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FontSource" AS ENUM ('GOOGLE', 'UPLOAD');

-- CreateEnum
CREATE TYPE "StorePageType" AS ENUM ('HOME', 'PAGE', 'PRODUCT_TEMPLATE', 'COLLECTION_TEMPLATE', 'CART', 'HEADER', 'FOOTER', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "PageVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "FigmaFile" ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "latestVersion" TEXT,
ADD COLUMN     "webhookId" TEXT,
ADD COLUMN     "webhookPasscodeHash" TEXT;

-- AlterTable
ALTER TABLE "DesignImport" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "installedAt" TIMESTAMP(3),
ADD COLUMN     "irSnapshotKey" TEXT,
ADD COLUMN     "kind" "DesignImportKind" NOT NULL DEFAULT 'INSTALL',
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "rawSnapshotKey" TEXT,
ADD COLUMN     "result" JSONB,
ADD COLUMN     "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "stats" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "warnings" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "SectionMapping" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "fieldMap" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignSystem" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "importId" TEXT,
    "version" INTEGER NOT NULL,
    "status" "DesignSystemStatus" NOT NULL DEFAULT 'DRAFT',
    "tokens" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Font" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "weights" INTEGER[],
    "source" "FontSource" NOT NULL,
    "files" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Font_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "sourceNodeId" TEXT,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "variants" JSONB NOT NULL DEFAULT '[]',
    "alt" TEXT NOT NULL DEFAULT '',
    "altReviewed" BOOLEAN NOT NULL DEFAULT false,
    "blurhash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePage" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "StorePageType" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seo" JSONB NOT NULL DEFAULT '{}',
    "publishedVersionId" TEXT,
    "sourceFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePageVersion" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sections" JSONB NOT NULL,
    "status" "PageVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "sourceImportId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "StorePageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SectionMapping_storeId_fileKey_nodeId_key" ON "SectionMapping"("storeId", "fileKey", "nodeId");

-- CreateIndex
CREATE INDEX "DesignSystem_storeId_status_idx" ON "DesignSystem"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DesignSystem_storeId_version_key" ON "DesignSystem"("storeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Font_storeId_family_key" ON "Font"("storeId", "family");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_storeId_hash_key" ON "Asset"("storeId", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "StorePage_publishedVersionId_key" ON "StorePage"("publishedVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "StorePage_storeId_slug_key" ON "StorePage"("storeId", "slug");

-- CreateIndex
CREATE INDEX "StorePageVersion_storeId_idx" ON "StorePageVersion"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StorePageVersion_pageId_version_key" ON "StorePageVersion"("pageId", "version");

-- CreateIndex
CREATE INDEX "DesignImport_status_runAfter_idx" ON "DesignImport"("status", "runAfter");

-- AddForeignKey
ALTER TABLE "SectionMapping" ADD CONSTRAINT "SectionMapping_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignSystem" ADD CONSTRAINT "DesignSystem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Font" ADD CONSTRAINT "Font_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePage" ADD CONSTRAINT "StorePage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePage" ADD CONSTRAINT "StorePage_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "StorePageVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePageVersion" ADD CONSTRAINT "StorePageVersion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePageVersion" ADD CONSTRAINT "StorePageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "StorePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security on the new store tables, and a system bypass for the background worker and webhooks
-- (src/backend/lib/tenancy.ts systemDb sets app.bypass_rls for cross-store lookups only).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['StoreMember','FigmaConnection','FigmaOAuthState','AuditLog','FigmaFile','DesignImport',
                           'SectionMapping','DesignSystem','Font','Asset','StorePage','StorePageVersion'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS store_isolation ON %I', t);
    EXECUTE format($p$CREATE POLICY store_isolation ON %I
      USING ("storeId" = current_setting('app.store_id', TRUE) OR current_setting('app.bypass_rls', TRUE) = 'on')
      WITH CHECK ("storeId" = current_setting('app.store_id', TRUE) OR current_setting('app.bypass_rls', TRUE) = 'on')$p$, t);
  END LOOP;
END $$;
