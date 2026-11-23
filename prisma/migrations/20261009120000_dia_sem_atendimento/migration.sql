-- Dia sem atendimento do centro (feriado, decreto, reunião). Só cria a tabela.
CREATE TABLE "DiaSemAtendimento" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaSemAtendimento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiaSemAtendimento_data_key" ON "DiaSemAtendimento"("data");
