-- AlterTable
ALTER TABLE "Atendimento" ADD COLUMN     "ausenciaId" TEXT,
ADD COLUMN     "observacao" TEXT;

-- AddForeignKey
ALTER TABLE "Atendimento" ADD CONSTRAINT "Atendimento_ausenciaId_fkey" FOREIGN KEY ("ausenciaId") REFERENCES "Ausencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
