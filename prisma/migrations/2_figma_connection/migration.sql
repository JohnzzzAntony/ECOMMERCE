-- CreateEnum
CREATE TYPE "StoreRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "FigmaAuthType" AS ENUM ('OAUTH', 'PAT');

-- CreateEnum
CREATE TYPE "FigmaConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH');

-- CreateTable
CREATE TABLE "StoreMember" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "StoreRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FigmaConnection" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "figmaUserId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "email" TEXT,
    "authType" "FigmaAuthType" NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "keyVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT NOT NULL DEFAULT '',
    "status" "FigmaConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FigmaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FigmaOAuthState" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FigmaOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "diff" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreMember_userId_idx" ON "StoreMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreMember_storeId_userId_key" ON "StoreMember"("storeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FigmaConnection_storeId_key" ON "FigmaConnection"("storeId");

-- CreateIndex
CREATE INDEX "FigmaOAuthState_storeId_idx" ON "FigmaOAuthState"("storeId");

-- CreateIndex
CREATE INDEX "FigmaOAuthState_expiresAt_idx" ON "FigmaOAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_storeId_createdAt_idx" ON "AuditLog"("storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FigmaConnection" ADD CONSTRAINT "FigmaConnection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FigmaOAuthState" ADD CONSTRAINT "FigmaOAuthState_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill legacy store membership from the global roles (before RLS is switched on below).
INSERT INTO "StoreMember" ("id", "storeId", "userId", "role")
SELECT 'sm_' || "id", 'legacy', "id", CASE WHEN "role" = 'admin' THEN 'OWNER'::"StoreRole" ELSE 'EDITOR'::"StoreRole" END
FROM "User" WHERE "role" IN ('admin', 'staff')
ON CONFLICT ("storeId", "userId") DO NOTHING;

-- Row level security: a row is visible only while app.store_id (set per transaction by storeDb()) equals its
-- storeId. FORCE applies the policy to the table owner too. Roles with BYPASSRLS (superusers) are not affected,
-- so run the app as a role without it.
ALTER TABLE "StoreMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreMember" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "StoreMember"
  USING ("storeId" = current_setting('app.store_id', TRUE))
  WITH CHECK ("storeId" = current_setting('app.store_id', TRUE));

ALTER TABLE "FigmaConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FigmaConnection" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "FigmaConnection"
  USING ("storeId" = current_setting('app.store_id', TRUE))
  WITH CHECK ("storeId" = current_setting('app.store_id', TRUE));

ALTER TABLE "FigmaOAuthState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FigmaOAuthState" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "FigmaOAuthState"
  USING ("storeId" = current_setting('app.store_id', TRUE))
  WITH CHECK ("storeId" = current_setting('app.store_id', TRUE));

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "AuditLog"
  USING ("storeId" = current_setting('app.store_id', TRUE))
  WITH CHECK ("storeId" = current_setting('app.store_id', TRUE));
