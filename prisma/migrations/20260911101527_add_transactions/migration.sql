-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('primary', 'secondary');

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "squareId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "type" "TransactionType" NOT NULL,
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripeCheckoutSessionId_key" ON "Transaction"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "Transaction_squareId_idx" ON "Transaction"("squareId");

-- CreateIndex
CREATE INDEX "Transaction_buyerId_idx" ON "Transaction"("buyerId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_squareId_fkey" FOREIGN KEY ("squareId") REFERENCES "Square"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
