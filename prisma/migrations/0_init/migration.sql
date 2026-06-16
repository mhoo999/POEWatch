-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('BOW', 'BELT', 'AMULET', 'RING', 'UNIQUE', 'WEAPON', 'ARMOUR', 'OTHER');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('NORMAL', 'MAGIC', 'RARE', 'UNIQUE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseType" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "rarity" "Rarity" NOT NULL DEFAULT 'UNKNOWN',
    "iconUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemListing" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "rawHash" TEXT NOT NULL,
    "sellerAccount" TEXT,
    "priceAmount" DOUBLE PRECISION,
    "priceCurrency" TEXT,
    "priceInBase" DOUBLE PRECISION,
    "isOutlier" BOOLEAN,
    "listedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemMod" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "modKey" TEXT,
    "value" DOUBLE PRECISION,

    CONSTRAINT "ItemMod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModDefinition" (
    "modKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "group" TEXT,
    "unit" TEXT,

    CONSTRAINT "ModDefinition_pkey" PRIMARY KEY ("modKey")
);

-- CreateTable
CREATE TABLE "ItemSnapshot" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalListings" INTEGER NOT NULL DEFAULT 0,
    "validListings" INTEGER NOT NULL DEFAULT 0,
    "premiumListings" INTEGER NOT NULL DEFAULT 0,
    "medianPrice" DOUBLE PRECISION,
    "medianPriceBase" DOUBLE PRECISION,

    CONSTRAINT "ItemSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyHistory" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" INTEGER NOT NULL,
    "valid" INTEGER NOT NULL,

    CONSTRAINT "SupplyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaTrend" (
    "id" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "league" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "share" DOUBLE PRECISION NOT NULL,
    "sampleN" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MetaTrend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketAlert" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "kind" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Item_category_idx" ON "Item"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Item_name_baseType_category_key" ON "Item"("name", "baseType", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ItemListing_rawHash_key" ON "ItemListing"("rawHash");

-- CreateIndex
CREATE INDEX "ItemListing_itemId_collectedAt_idx" ON "ItemListing"("itemId", "collectedAt");

-- CreateIndex
CREATE INDEX "ItemListing_league_idx" ON "ItemListing"("league");

-- CreateIndex
CREATE INDEX "ItemMod_listingId_idx" ON "ItemMod"("listingId");

-- CreateIndex
CREATE INDEX "ItemMod_modKey_idx" ON "ItemMod"("modKey");

-- CreateIndex
CREATE INDEX "ItemSnapshot_itemId_collectedAt_idx" ON "ItemSnapshot"("itemId", "collectedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_itemId_ts_idx" ON "PriceHistory"("itemId", "ts");

-- CreateIndex
CREATE INDEX "SupplyHistory_itemId_ts_idx" ON "SupplyHistory"("itemId", "ts");

-- CreateIndex
CREATE INDEX "MetaTrend_category_league_ts_idx" ON "MetaTrend"("category", "league", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_league_currency_base_key" ON "CurrencyRate"("league", "currency", "base");

-- AddForeignKey
ALTER TABLE "ItemListing" ADD CONSTRAINT "ItemListing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemMod" ADD CONSTRAINT "ItemMod_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ItemListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSnapshot" ADD CONSTRAINT "ItemSnapshot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyHistory" ADD CONSTRAINT "SupplyHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
