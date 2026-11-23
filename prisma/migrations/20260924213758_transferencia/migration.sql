-- CreateTable
CREATE TABLE "Transferencia" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "deProfissionalId" TEXT NOT NULL,
    "paraProfissionalId" TEXT NOT NULL,
    "vinculoAnteriorId" TEXT,
    "vinculoNovoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transferencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transferencia_alunoId_paraProfissionalId_idx" ON "Transferencia"("alunoId", "paraProfissionalId");

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_deProfissionalId_fkey" FOREIGN KEY ("deProfissionalId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_paraProfissionalId_fkey" FOREIGN KEY ("paraProfissionalId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
