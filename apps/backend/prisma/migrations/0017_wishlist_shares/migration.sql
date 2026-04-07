CREATE TABLE "WishlistShare" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WishlistShare_userId_key" ON "WishlistShare"("userId");
CREATE UNIQUE INDEX "WishlistShare_token_key" ON "WishlistShare"("token");
CREATE INDEX "WishlistShare_token_isActive_idx" ON "WishlistShare"("token", "isActive");
CREATE INDEX "WishlistShare_expiresAt_idx" ON "WishlistShare"("expiresAt");

ALTER TABLE "WishlistShare"
ADD CONSTRAINT "WishlistShare_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
