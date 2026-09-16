-- CreateTable
CREATE TABLE "CommissionPayment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "succeededAt" TIMESTAMP(3),

    CONSTRAINT "CommissionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPayment_stripeCheckoutSessionId_key" ON "CommissionPayment"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "CommissionPayment_storeId_idx" ON "CommissionPayment"("storeId");

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
