-- AlterTable
ALTER TABLE "Atendimento" ADD COLUMN     "confirmadoEm" TIMESTAMP(3),
ADD COLUMN     "registradoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "Atendimento" ADD CONSTRAINT "Atendimento_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
