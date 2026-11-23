-- CreateEnum
CREATE TYPE "TipoAusencia" AS ENUM ('FALTA', 'ATESTADO', 'LICENCA', 'FERIAS', 'CAPACITACAO', 'OUTRO');

-- AlterEnum
ALTER TYPE "SituacaoAtendimento" ADD VALUE 'CANCELADO';

-- CreateTable
CREATE TABLE "Ausencia" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "tipo" "TipoAusencia" NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "justificativa" TEXT,
    "documentoChave" TEXT,
    "registradoPor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excluidoEm" TIMESTAMP(3),

    CONSTRAINT "Ausencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ausencia_profissionalId_inicio_idx" ON "Ausencia"("profissionalId", "inicio");

-- AddForeignKey
ALTER TABLE "Ausencia" ADD CONSTRAINT "Ausencia_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
