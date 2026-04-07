CREATE TABLE "CartReminderEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "latestCartUpdatedAt" TIMESTAMP(3) NOT NULL,
    "cartItemCount" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartReminderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CartReminderEvent_userId_createdAt_idx" ON "CartReminderEvent"("userId", "createdAt");
CREATE INDEX "CartReminderEvent_userId_latestCartUpdatedAt_idx" ON "CartReminderEvent"("userId", "latestCartUpdatedAt");
CREATE INDEX "CartReminderEvent_notificationId_idx" ON "CartReminderEvent"("notificationId");

ALTER TABLE "CartReminderEvent"
ADD CONSTRAINT "CartReminderEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
