/*
  Warnings:

  - You are about to drop the column `arenaId` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_arenaId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "arenaId",
ADD COLUMN     "activeArenaId" TEXT;

-- CreateTable
CREATE TABLE "_ArenaAdmins" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArenaAdmins_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ArenaAdmins_B_index" ON "_ArenaAdmins"("B");

-- AddForeignKey
ALTER TABLE "_ArenaAdmins" ADD CONSTRAINT "_ArenaAdmins_A_fkey" FOREIGN KEY ("A") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArenaAdmins" ADD CONSTRAINT "_ArenaAdmins_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
