CREATE TYPE "OrderNoteVisibility" AS ENUM ('internal', 'customer');

CREATE TABLE "OrderNote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "visibility" "OrderNoteVisibility" NOT NULL DEFAULT 'customer',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderNote_orderId_visibility_createdAt_idx" ON "OrderNote"("orderId", "visibility", "createdAt");
CREATE INDEX "OrderNote_authorId_createdAt_idx" ON "OrderNote"("authorId", "createdAt");

ALTER TABLE "OrderNote"
ADD CONSTRAINT "OrderNote_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderNote"
ADD CONSTRAINT "OrderNote_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
