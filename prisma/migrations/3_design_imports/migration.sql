-- CreateEnum
CREATE TYPE "DesignImportStatus" AS ENUM ('QUEUED', 'FETCHING', 'NORMALIZING', 'TOKENS', 'MAPPING', 'ASSETS', 'REVIEW', 'INSTALLED', 'FAILED');

-- CreateTable
CREATE TABLE "FigmaFile" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "connectionId" TEXT,
    "fileKey" TEXT NOT NULL,
    "branchKey" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "lastModified" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FigmaFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignImport" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "figmaVersion" TEXT NOT NULL,
    "status" "DesignImportStatus" NOT NULL DEFAULT 'QUEUED',
    "selectedNodeIds" TEXT[],
    "pageAssignments" JSONB NOT NULL,
    "error" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FigmaFile_storeId_fileKey_branchKey_key" ON "FigmaFile"("storeId", "fileKey", "branchKey");

-- CreateIndex
CREATE INDEX "DesignImport_storeId_createdAt_idx" ON "DesignImport"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "DesignImport_fileId_idx" ON "DesignImport"("fileId");

-- AddForeignKey
ALTER TABLE "FigmaFile" ADD CONSTRAINT "FigmaFile_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FigmaFile" ADD CONSTRAINT "FigmaFile_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "FigmaConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignImport" ADD CONSTRAINT "DesignImport_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignImport" ADD CONSTRAINT "DesignImport_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FigmaFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security (see 2_figma_connection).
ALTER TABLE "FigmaFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FigmaFile" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "FigmaFile"
  USING ("storeId" = current_setting('app.store_id', TRUE))
  WITH CHECK ("storeId" = current_setting('app.store_id', TRUE));

ALTER TABLE "DesignImport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DesignImport" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "DesignImport"
  USING ("storeId" = current_setting('app.store_id', TRUE))
  WITH CHECK ("storeId" = current_setting('app.store_id', TRUE));
