-- AlterTable
ALTER TABLE "Aluno" ADD COLUMN     "excluidoPor" TEXT;

-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "excluidoPor" TEXT;

-- AlterTable
ALTER TABLE "Evolucao" ADD COLUMN     "excluidoEm" TIMESTAMP(3),
ADD COLUMN     "excluidoPor" TEXT;

-- AlterTable
ALTER TABLE "Horario" ADD COLUMN     "excluidoEm" TIMESTAMP(3),
ADD COLUMN     "excluidoPor" TEXT;
