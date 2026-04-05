ALTER TABLE "CartItem"
ADD COLUMN "variantId" TEXT;

ALTER TABLE "InventoryReservationItem"
ADD COLUMN "variantId" TEXT;

ALTER TABLE "OrderItem"
ADD COLUMN "variantId" TEXT;

WITH "preferredVariants" AS (
    SELECT DISTINCT ON ("productId")
        "productId",
        "id" AS "variantId"
    FROM "ProductVariant"
    ORDER BY "productId", "isDefault" DESC, "createdAt" ASC
)
UPDATE "CartItem" AS "Cart"
SET "variantId" = "preferredVariants"."variantId"
FROM "preferredVariants"
WHERE "Cart"."productId" = "preferredVariants"."productId"
  AND "Cart"."variantId" IS NULL;

WITH "preferredVariants" AS (
    SELECT DISTINCT ON ("productId")
        "productId",
        "id" AS "variantId"
    FROM "ProductVariant"
    ORDER BY "productId", "isDefault" DESC, "createdAt" ASC
)
UPDATE "InventoryReservationItem" AS "ReservationItem"
SET "variantId" = "preferredVariants"."variantId"
FROM "preferredVariants"
WHERE "ReservationItem"."productId" = "preferredVariants"."productId"
  AND "ReservationItem"."variantId" IS NULL;

WITH "preferredVariants" AS (
    SELECT DISTINCT ON ("productId")
        "productId",
        "id" AS "variantId"
    FROM "ProductVariant"
    ORDER BY "productId", "isDefault" DESC, "createdAt" ASC
)
UPDATE "OrderItem" AS "OrderLine"
SET "variantId" = "preferredVariants"."variantId"
FROM "preferredVariants"
WHERE "OrderLine"."productId" = "preferredVariants"."productId"
  AND "OrderLine"."variantId" IS NULL;

ALTER TABLE "CartItem"
ALTER COLUMN "variantId" SET NOT NULL;

ALTER TABLE "InventoryReservationItem"
ALTER COLUMN "variantId" SET NOT NULL;

DROP INDEX "CartItem_userId_productId_key";

CREATE UNIQUE INDEX "CartItem_userId_productId_variantId_key" ON "CartItem"("userId", "productId", "variantId");
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");
CREATE INDEX "InventoryReservationItem_variantId_idx" ON "InventoryReservationItem"("variantId");
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryReservationItem"
ADD CONSTRAINT "InventoryReservationItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
