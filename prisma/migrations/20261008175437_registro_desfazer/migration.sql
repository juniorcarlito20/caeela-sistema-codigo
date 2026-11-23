-- AlterTable
ALTER TABLE "RegistroAcesso" ADD COLUMN     "desfeitoEm" TIMESTAMP(3),
ADD COLUMN     "desfeitoPorId" TEXT,
ADD COLUMN     "mudanca" JSONB;
