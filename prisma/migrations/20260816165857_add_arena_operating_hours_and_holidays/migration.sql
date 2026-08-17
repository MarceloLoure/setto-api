-- CreateTable
CREATE TABLE "ArenaOperatingHour" (
    "id" TEXT NOT NULL,
    "arenaId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaOperatingHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaHoliday" (
    "id" TEXT NOT NULL,
    "arenaId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArenaOperatingHour_arenaId_dayOfWeek_key" ON "ArenaOperatingHour"("arenaId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaHoliday_arenaId_date_key" ON "ArenaHoliday"("arenaId", "date");

-- AddForeignKey
ALTER TABLE "ArenaOperatingHour" ADD CONSTRAINT "ArenaOperatingHour_arenaId_fkey" FOREIGN KEY ("arenaId") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaHoliday" ADD CONSTRAINT "ArenaHoliday_arenaId_fkey" FOREIGN KEY ("arenaId") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
