CREATE TYPE "ProductQuestionStatus" AS ENUM ('pending', 'published', 'rejected');

CREATE TABLE "ProductQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" "ProductQuestionStatus" NOT NULL DEFAULT 'published',
    "upvoteCount" INTEGER NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3),
    "answeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductQuestionUpvote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductQuestionUpvote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductQuestionUpvote_userId_questionId_key" ON "ProductQuestionUpvote"("userId", "questionId");
CREATE INDEX "ProductQuestion_productId_status_createdAt_idx" ON "ProductQuestion"("productId", "status", "createdAt");
CREATE INDEX "ProductQuestion_productId_upvoteCount_createdAt_idx" ON "ProductQuestion"("productId", "upvoteCount", "createdAt");
CREATE INDEX "ProductQuestion_userId_createdAt_idx" ON "ProductQuestion"("userId", "createdAt");
CREATE INDEX "ProductQuestion_answeredById_idx" ON "ProductQuestion"("answeredById");
CREATE INDEX "ProductQuestionUpvote_questionId_createdAt_idx" ON "ProductQuestionUpvote"("questionId", "createdAt");
CREATE INDEX "ProductQuestionUpvote_userId_createdAt_idx" ON "ProductQuestionUpvote"("userId", "createdAt");

ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductQuestionUpvote" ADD CONSTRAINT "ProductQuestionUpvote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductQuestionUpvote" ADD CONSTRAINT "ProductQuestionUpvote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ProductQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
