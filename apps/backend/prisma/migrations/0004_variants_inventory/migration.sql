CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributes" JSONB,
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryLevel" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "available" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLevel_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InventoryMovement"
ADD COLUMN "variantId" TEXT;

CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_isDefault_idx" ON "ProductVariant"("productId", "isDefault");
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

CREATE UNIQUE INDEX "InventoryLevel_variantId_warehouseId_key" ON "InventoryLevel"("variantId", "warehouseId");
CREATE INDEX "InventoryLevel_productId_warehouseId_idx" ON "InventoryLevel"("productId", "warehouseId");
CREATE INDEX "InventoryLevel_warehouseId_available_idx" ON "InventoryLevel"("warehouseId", "available");

CREATE INDEX "InventoryMovement_variantId_createdAt_idx" ON "InventoryMovement"("variantId", "createdAt");

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryLevel"
ADD CONSTRAINT "InventoryLevel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryLevel"
ADD CONSTRAINT "InventoryLevel_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryLevel"
ADD CONSTRAINT "InventoryLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Warehouse" ("id", "code", "name", "city", "isDefault", "createdAt", "updatedAt")
SELECT
    'warehouse-main',
    'MAIN',
    'Main Warehouse',
    NULL,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1
    FROM "Warehouse"
    WHERE "isDefault" = true
);

INSERT INTO "ProductVariant" (
    "id",
    "productId",
    "sku",
    "name",
    "price",
    "stock",
    "isDefault",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    "id" || '-default',
    "id",
    "sku" || '-DEFAULT',
    "name" || ' Default',
    "price",
    "stock",
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Product"
WHERE NOT EXISTS (
    SELECT 1
    FROM "ProductVariant"
    WHERE "ProductVariant"."productId" = "Product"."id"
);

WITH "defaultWarehouse" AS (
    SELECT "id"
    FROM "Warehouse"
    WHERE "isDefault" = true
    ORDER BY "createdAt" ASC
    LIMIT 1
)
INSERT INTO "InventoryLevel" (
    "id",
    "productId",
    "variantId",
    "warehouseId",
    "available",
    "reserved",
    "createdAt",
    "updatedAt"
)
SELECT
    "ProductVariant"."id" || '-stock',
    "ProductVariant"."productId",
    "ProductVariant"."id",
    "defaultWarehouse"."id",
    "ProductVariant"."stock",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "ProductVariant"
CROSS JOIN "defaultWarehouse"
WHERE NOT EXISTS (
    SELECT 1
    FROM "InventoryLevel"
    WHERE "InventoryLevel"."variantId" = "ProductVariant"."id"
      AND "InventoryLevel"."warehouseId" = "defaultWarehouse"."id"
);
