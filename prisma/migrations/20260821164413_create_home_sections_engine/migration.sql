-- CreateEnum
CREATE TYPE "HomeSectionType" AS ENUM ('HERO_BANNERS', 'STRIP_BANNER', 'NEXT_BOOKINGS', 'FOLLOWED_ARENAS', 'CITY_ARENAS', 'RECOMMENDED_ARENAS');

-- CreateTable
CREATE TABLE "home_sections" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "type" "HomeSectionType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_sections_pkey" PRIMARY KEY ("id")
);
