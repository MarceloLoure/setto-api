/*
  Warnings:

  - A unique constraint covering the columns `[cpf]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "state" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");
