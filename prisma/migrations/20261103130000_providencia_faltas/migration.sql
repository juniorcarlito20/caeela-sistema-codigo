-- CreateEnum
CREATE TYPE "TipoProvidenciaFalta" AS ENUM ('CONTATO_FAMILIA', 'ASSISTENCIA_SOCIAL', 'OUTRA');

-- CreateTable
CREATE TABLE "ProvidenciaFalta" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "tipo" "TipoProvidenciaFalta" NOT NULL,
    "observacao" TEXT,
    "cobreAte" TIMESTAMP(3) NOT NULL,
    "autorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvidenciaFalta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProvidenciaFalta_alunoId_idx" ON "ProvidenciaFalta"("alunoId");

-- AddForeignKey
ALTER TABLE "ProvidenciaFalta" ADD CONSTRAINT "ProvidenciaFalta_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvidenciaFalta" ADD CONSTRAINT "ProvidenciaFalta_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
