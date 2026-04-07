CREATE TABLE "LoyaltyRedemption" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "pointsSpent" INTEGER NOT NULL,
  "discountAmount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoyaltyRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoyaltyRedemption_couponId_key" ON "LoyaltyRedemption"("couponId");
CREATE INDEX "LoyaltyRedemption_userId_createdAt_idx" ON "LoyaltyRedemption"("userId", "createdAt");

ALTER TABLE "LoyaltyRedemption"
ADD CONSTRAINT "LoyaltyRedemption_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoyaltyRedemption"
ADD CONSTRAINT "LoyaltyRedemption_couponId_fkey"
FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
