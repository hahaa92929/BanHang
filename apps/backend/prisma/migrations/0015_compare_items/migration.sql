CREATE TABLE "CompareItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompareItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompareItem_userId_productId_key" ON "CompareItem"("userId", "productId");
CREATE INDEX "CompareItem_userId_createdAt_idx" ON "CompareItem"("userId", "createdAt");

ALTER TABLE "CompareItem" ADD CONSTRAINT "CompareItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompareItem" ADD CONSTRAINT "CompareItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
