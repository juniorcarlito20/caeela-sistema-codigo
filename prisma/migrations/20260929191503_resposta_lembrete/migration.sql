-- CreateEnum
CREATE TYPE "RespostaLembrete" AS ENUM ('VAI', 'NAO_VAI');

-- AlterTable
ALTER TABLE "Lembrete" ADD COLUMN     "resposta" "RespostaLembrete";
