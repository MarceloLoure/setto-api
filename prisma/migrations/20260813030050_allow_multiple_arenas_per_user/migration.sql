/*
  Warnings:

  - You are about to drop the column `taxId` on the `arenas` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cnpj]` on the table `arenas` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "arenas_taxId_key";

-- AlterTable
ALTER TABLE "arenas" DROP COLUMN "taxId",
ADD COLUMN     "cnpj" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "arenas_cnpj_key" ON "arenas"("cnpj");
