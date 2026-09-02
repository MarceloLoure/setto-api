/*
  Warnings:

  - A unique constraint covering the columns `[cpf]` on the table `arenas` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "arenas" ADD COLUMN     "companyType" TEXT DEFAULT 'MEI',
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "incomeValue" DECIMAL(10,2) DEFAULT 10000.00,
ADD COLUMN     "mobilePhone" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "arenas_cpf_key" ON "arenas"("cpf");
