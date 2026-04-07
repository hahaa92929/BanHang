CREATE TYPE "PromotionKind" AS ENUM ('banner', 'flash_sale', 'popup', 'newsletter');
CREATE TYPE "PromotionPlacement" AS ENUM ('home_hero', 'home_flash_sale', 'home_popup', 'category_top', 'checkout_sidebar');

CREATE TABLE "ContentPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "tags" TEXT[],
    "readTimeMinutes" INTEGER NOT NULL DEFAULT 3,
    "relatedProductIds" TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionCampaign" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PromotionKind" NOT NULL,
    "placement" "PromotionPlacement" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "content" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "linkUrl" TEXT,
    "couponCode" TEXT,
    "discountPercent" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentPage_slug_key" ON "ContentPage"("slug");
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE UNIQUE INDEX "PromotionCampaign_key_key" ON "PromotionCampaign"("key");
CREATE INDEX "ContentPage_isPublished_publishedAt_idx" ON "ContentPage"("isPublished", "publishedAt");
CREATE INDEX "BlogPost_isPublished_publishedAt_idx" ON "BlogPost"("isPublished", "publishedAt");
CREATE INDEX "PromotionCampaign_placement_isActive_startsAt_idx" ON "PromotionCampaign"("placement", "isActive", "startsAt");
CREATE INDEX "PromotionCampaign_kind_isActive_startsAt_idx" ON "PromotionCampaign"("kind", "isActive", "startsAt");
