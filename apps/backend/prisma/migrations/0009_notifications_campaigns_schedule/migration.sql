ALTER TABLE "Notification"
ADD COLUMN "campaignKey" TEXT,
ADD COLUMN "scheduledFor" TIMESTAMP(3);

CREATE INDEX "Notification_campaignKey_idx" ON "Notification"("campaignKey");
CREATE INDEX "Notification_scheduledFor_deliveredAt_idx" ON "Notification"("scheduledFor", "deliveredAt");
