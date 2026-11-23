-- CreateTable
CREATE TABLE "SlotProfissional" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "hora" TEXT NOT NULL,
    "duracaoMin" INTEGER NOT NULL DEFAULT 40,

    CONSTRAINT "SlotProfissional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlotProfissional_profissionalId_idx" ON "SlotProfissional"("profissionalId");

-- CreateIndex
CREATE UNIQUE INDEX "SlotProfissional_profissionalId_diaSemana_hora_key" ON "SlotProfissional"("profissionalId", "diaSemana", "hora");

-- AddForeignKey
ALTER TABLE "SlotProfissional" ADD CONSTRAINT "SlotProfissional_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
