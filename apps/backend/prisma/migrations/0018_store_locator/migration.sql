CREATE TYPE "StoreAppointmentStatus" AS ENUM ('requested', 'confirmed', 'completed', 'canceled');

CREATE TABLE "StoreLocation" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "ward" TEXT,
    "addressLine" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Viet Nam',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "openingHours" JSONB,
    "services" TEXT[],
    "mapsUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreAppointment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "service" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" "StoreAppointmentStatus" NOT NULL DEFAULT 'requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreAppointment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreLocation_slug_key" ON "StoreLocation"("slug");
CREATE INDEX "StoreLocation_province_district_isActive_idx" ON "StoreLocation"("province", "district", "isActive");
CREATE INDEX "StoreLocation_isActive_createdAt_idx" ON "StoreLocation"("isActive", "createdAt");
CREATE INDEX "StoreAppointment_storeId_scheduledFor_idx" ON "StoreAppointment"("storeId", "scheduledFor");
CREATE INDEX "StoreAppointment_status_createdAt_idx" ON "StoreAppointment"("status", "createdAt");

ALTER TABLE "StoreAppointment"
ADD CONSTRAINT "StoreAppointment_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "StoreLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
