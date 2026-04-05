CREATE TABLE "SearchQueryEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "query" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "expandedTerms" TEXT[],
    "resultCount" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQueryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchQueryEvent_normalizedQuery_createdAt_idx"
ON "SearchQueryEvent"("normalizedQuery", "createdAt");

CREATE INDEX "SearchQueryEvent_resultCount_createdAt_idx"
ON "SearchQueryEvent"("resultCount", "createdAt");

CREATE INDEX "SearchQueryEvent_createdAt_idx"
ON "SearchQueryEvent"("createdAt");
