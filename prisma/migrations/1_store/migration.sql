-- CreateEnum
CREATE TYPE "DesignSource" AS ENUM ('FIGMA', 'THEME');

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "designSource" "DesignSource" NOT NULL DEFAULT 'FIGMA',
    "themesEnabled" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Store_domain_key" ON "Store"("domain");


-- Existing single-store data is owned by the legacy store, which renders with the theme system.
INSERT INTO "Store" ("id", "slug", "name", "designSource", "updatedAt") VALUES ('legacy', 'legacy', 'NexEcoms', 'THEME', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
