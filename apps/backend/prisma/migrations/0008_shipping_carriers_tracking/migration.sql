CREATE TYPE "ShippingCarrier" AS ENUM (
    'internal',
    'ghn',
    'ghtk',
    'jt',
    'viettel_post',
    'grab_express'
);

ALTER TABLE "Order"
ADD COLUMN "shippingCarrier" "ShippingCarrier",
ADD COLUMN "shippingServiceCode" TEXT,
ADD COLUMN "shippingLabelUrl" TEXT;

CREATE INDEX "Order_shippingCarrier_shippingStatus_idx" ON "Order"("shippingCarrier", "shippingStatus");

CREATE TABLE "ShippingTrackingEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ShippingStatus" NOT NULL,
    "carrier" "ShippingCarrier",
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingTrackingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShippingTrackingEvent_orderId_occurredAt_idx"
ON "ShippingTrackingEvent"("orderId", "occurredAt");

CREATE INDEX "ShippingTrackingEvent_carrier_occurredAt_idx"
ON "ShippingTrackingEvent"("carrier", "occurredAt");

ALTER TABLE "ShippingTrackingEvent" ADD CONSTRAINT "ShippingTrackingEvent_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
