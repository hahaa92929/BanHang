CREATE TABLE "CustomerTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerTag_userId_key_key" ON "CustomerTag"("userId", "key");
CREATE INDEX "CustomerTag_userId_createdAt_idx" ON "CustomerTag"("userId", "createdAt");
CREATE INDEX "CustomerNote_userId_isPinned_createdAt_idx" ON "CustomerNote"("userId", "isPinned", "createdAt");
CREATE INDEX "CustomerNote_authorId_createdAt_idx" ON "CustomerNote"("authorId", "createdAt");

ALTER TABLE "CustomerTag"
ADD CONSTRAINT "CustomerTag_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerNote"
ADD CONSTRAINT "CustomerNote_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerNote"
ADD CONSTRAINT "CustomerNote_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
