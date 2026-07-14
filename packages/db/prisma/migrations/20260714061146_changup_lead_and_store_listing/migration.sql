-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('DIRECT', 'FULL_AUTO', 'CONSIGNMENT', 'FRANCHISE_HQ');

-- CreateEnum
CREATE TYPE "StoreListingStatus" AS ENUM ('ACTIVE', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'MEETING_SET', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('PHONE', 'SMS', 'KAKAO');

-- CreateTable
CREATE TABLE "StoreListing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "operationType" "OperationType" NOT NULL,
    "deposit" INTEGER NOT NULL,
    "monthlyRent" INTEGER NOT NULL,
    "premium" INTEGER NOT NULL,
    "status" "StoreListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactChannel" "ContactChannel" NOT NULL DEFAULT 'PHONE',
    "operationTypes" "OperationType"[] DEFAULT ARRAY[]::"OperationType"[],
    "industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "depositMax" INTEGER,
    "rentMax" INTEGER,
    "premiumMax" INTEGER,
    "notes" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreListing_status_region_idx" ON "StoreListing"("status", "region");

-- CreateIndex
CREATE INDEX "BuyerLead_status_createdAt_idx" ON "BuyerLead"("status", "createdAt");
