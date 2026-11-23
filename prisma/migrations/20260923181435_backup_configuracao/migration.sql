-- AlterTable
ALTER TABLE "Configuracao" ADD COLUMN     "ultimoBackupEm" TIMESTAMP(3),
ADD COLUMN     "ultimoBackupOk" BOOLEAN NOT NULL DEFAULT false;
