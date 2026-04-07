CREATE TYPE "ReferralStatus" AS ENUM ('signed_up', 'qualified', 'rewarded');

ALTER TABLE "User"
ADD COLUMN "referralCode" TEXT,
ADD COLUMN "referredById" TEXT;

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

ALTER TABLE "User"
ADD CONSTRAINT "User_referredById_fkey"
FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReferralEvent" (
  "id" TEXT NOT NULL,
  "referralCode" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "status" "ReferralStatus" NOT NULL DEFAULT 'signed_up',
  "rewardPoints" INTEGER NOT NULL DEFAULT 100,
  "qualifiedOrderId" TEXT,
  "qualifiedAt" TIMESTAMP(3),
  "rewardGrantedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReferralEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralEvent_referredUserId_key" ON "ReferralEvent"("referredUserId");
CREATE INDEX "ReferralEvent_referrerId_status_createdAt_idx" ON "ReferralEvent"("referrerId", "status", "createdAt");
CREATE INDEX "ReferralEvent_referralCode_createdAt_idx" ON "ReferralEvent"("referralCode", "createdAt");
CREATE INDEX "ReferralEvent_qualifiedOrderId_idx" ON "ReferralEvent"("qualifiedOrderId");

ALTER TABLE "ReferralEvent"
ADD CONSTRAINT "ReferralEvent_referrerId_fkey"
FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralEvent"
ADD CONSTRAINT "ReferralEvent_referredUserId_fkey"
FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
