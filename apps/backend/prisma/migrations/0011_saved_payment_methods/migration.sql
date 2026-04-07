CREATE TABLE "SavedPaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "label" TEXT NOT NULL,
    "brand" TEXT,
    "last4" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "tokenRef" TEXT NOT NULL,
    "providerCustomerRef" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedPaymentMethod_tokenRef_key" ON "SavedPaymentMethod"("tokenRef");
CREATE INDEX "SavedPaymentMethod_userId_isDefault_createdAt_idx" ON "SavedPaymentMethod"("userId", "isDefault", "createdAt");
CREATE INDEX "SavedPaymentMethod_userId_method_createdAt_idx" ON "SavedPaymentMethod"("userId", "method", "createdAt");

ALTER TABLE "SavedPaymentMethod"
ADD CONSTRAINT "SavedPaymentMethod_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
