-- CreateTable
CREATE TABLE "HorarioIndisponivel" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "hora" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPor" TEXT NOT NULL,

    CONSTRAINT "HorarioIndisponivel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HorarioIndisponivel_profissionalId_idx" ON "HorarioIndisponivel"("profissionalId");

-- CreateIndex
CREATE UNIQUE INDEX "HorarioIndisponivel_profissionalId_diaSemana_hora_key" ON "HorarioIndisponivel"("profissionalId", "diaSemana", "hora");

-- AddForeignKey
ALTER TABLE "HorarioIndisponivel" ADD CONSTRAINT "HorarioIndisponivel_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
