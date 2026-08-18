/*
  Warnings:

  - You are about to drop the column `coverUrl` on the `arenas` table. All the data in the column will be lost.
  - You are about to drop the column `logoUrl` on the `arenas` table. All the data in the column will be lost.
  - You are about to drop the column `photos` on the `arenas` table. All the data in the column will be lost.
  - You are about to drop the column `photos` on the `courts` table. All the data in the column will be lost.
  - You are about to drop the column `avatarUrl` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `coverUrl` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "arenas" DROP COLUMN "coverUrl",
DROP COLUMN "logoUrl",
DROP COLUMN "photos";

-- AlterTable
ALTER TABLE "courts" DROP COLUMN "photos";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "avatarUrl",
DROP COLUMN "coverUrl";

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "userIdAvatar" TEXT,
    "userIdCover" TEXT,
    "arenaIdLogo" TEXT,
    "arenaIdCover" TEXT,
    "arenaGalleryId" TEXT,
    "courtGalleryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_userIdAvatar_key" ON "files"("userIdAvatar");

-- CreateIndex
CREATE UNIQUE INDEX "files_userIdCover_key" ON "files"("userIdCover");

-- CreateIndex
CREATE UNIQUE INDEX "files_arenaIdLogo_key" ON "files"("arenaIdLogo");

-- CreateIndex
CREATE UNIQUE INDEX "files_arenaIdCover_key" ON "files"("arenaIdCover");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_userIdAvatar_fkey" FOREIGN KEY ("userIdAvatar") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_userIdCover_fkey" FOREIGN KEY ("userIdCover") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_arenaIdLogo_fkey" FOREIGN KEY ("arenaIdLogo") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_arenaIdCover_fkey" FOREIGN KEY ("arenaIdCover") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_arenaGalleryId_fkey" FOREIGN KEY ("arenaGalleryId") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_courtGalleryId_fkey" FOREIGN KEY ("courtGalleryId") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
