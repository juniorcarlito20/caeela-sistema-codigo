-- CreateEnum
CREATE TYPE "TipoSugestao" AS ENUM ('PROFISSIONAL_DO_CENTRO', 'EXAME_OU_CONSULTA', 'OUTRA');

-- CreateEnum
CREATE TYPE "SituacaoSugestao" AS ENUM ('PENDENTE', 'RESOLVIDA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "Sugestao" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipo" "TipoSugestao" NOT NULL,
    "areaId" TEXT,
    "texto" TEXT NOT NULL,
    "situacao" "SituacaoSugestao" NOT NULL DEFAULT 'PENDENTE',
    "observacaoDirecao" TEXT,
    "fechadaPorId" TEXT,
    "fechadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sugestao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sugestao_situacao_criadoEm_idx" ON "Sugestao"("situacao", "criadoEm");

-- CreateIndex
CREATE INDEX "Sugestao_alunoId_idx" ON "Sugestao"("alunoId");

-- AddForeignKey
ALTER TABLE "Sugestao" ADD CONSTRAINT "Sugestao_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sugestao" ADD CONSTRAINT "Sugestao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sugestao" ADD CONSTRAINT "Sugestao_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
