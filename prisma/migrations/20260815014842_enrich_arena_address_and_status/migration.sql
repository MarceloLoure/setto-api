-- AlterTable
ALTER TABLE "arenas" ADD COLUMN     "complement" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "zipCode" TEXT;
