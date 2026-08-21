-- CreateEnum
CREATE TYPE "BannerPosition" AS ENUM ('HERO', 'STRIP', 'POPUP');

-- CreateEnum
CREATE TYPE "BannerActionType" AS ENUM ('ARENA_DETAILS', 'COURT_DETAILS', 'EXTERNAL_URL', 'NONE');

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "position" "BannerPosition" NOT NULL DEFAULT 'HERO',
    "actionType" "BannerActionType" NOT NULL DEFAULT 'NONE',
    "actionValue" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "imageFileId" TEXT NOT NULL,
    "arenaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "banners_imageFileId_key" ON "banners"("imageFileId");

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_arenaId_fkey" FOREIGN KEY ("arenaId") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
