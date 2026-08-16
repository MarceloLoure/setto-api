-- AlterTable
ALTER TABLE "arenas" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "courts" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
