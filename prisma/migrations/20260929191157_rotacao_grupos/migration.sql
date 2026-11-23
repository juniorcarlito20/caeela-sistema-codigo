-- AlterTable
ALTER TABLE "Horario" ADD COLUMN     "cicloOffset" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cicloSemanas" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "semanaReferencia" TIMESTAMP(3);
