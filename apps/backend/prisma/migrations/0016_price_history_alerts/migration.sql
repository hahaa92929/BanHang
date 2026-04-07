CREATE TABLE "ProductPriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "previousPrice" INTEGER,
    "source" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetPrice" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedPrice" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PriceAlert_userId_productId_key" ON "PriceAlert"("userId", "productId");
CREATE INDEX "ProductPriceHistory_productId_changedAt_idx" ON "ProductPriceHistory"("productId", "changedAt");
CREATE INDEX "PriceAlert_userId_isActive_createdAt_idx" ON "PriceAlert"("userId", "isActive", "createdAt");
CREATE INDEX "PriceAlert_productId_isActive_targetPrice_idx" ON "PriceAlert"("productId", "isActive", "targetPrice");

ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
