-- CreateEnum
CREATE TYPE "SquareStatus" AS ENUM ('platform', 'owned', 'listed');

-- CreateEnum
CREATE TYPE "PriceLabel" AS ENUM ('fair', 'balanced', 'unfair');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeCustomerId" TEXT,
    "stripeConnectAccountId" TEXT,
    "connectOnboardingComplete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Square" (
    "id" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "status" "SquareStatus" NOT NULL DEFAULT 'platform',
    "ownerId" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "listPriceCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Square_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceQuote" (
    "id" TEXT NOT NULL,
    "squareId" TEXT NOT NULL,
    "suggestedPriceCents" INTEGER NOT NULL,
    "label" "PriceLabel" NOT NULL,
    "reason" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Square_status_idx" ON "Square"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Square_x_y_key" ON "Square"("x", "y");

-- CreateIndex
CREATE UNIQUE INDEX "PriceQuote_squareId_key" ON "PriceQuote"("squareId");

-- AddForeignKey
ALTER TABLE "Square" ADD CONSTRAINT "Square_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceQuote" ADD CONSTRAINT "PriceQuote_squareId_fkey" FOREIGN KEY ("squareId") REFERENCES "Square"("id") ON DELETE CASCADE ON UPDATE CASCADE;
