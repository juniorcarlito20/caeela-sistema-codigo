-- CreateEnum
CREATE TYPE "TipoAgenda" AS ENUM ('FIXA', 'AVULSA_DIRECAO', 'AVULSA_PROPRIA');

-- CreateEnum
CREATE TYPE "TipoConsulta" AS ENUM ('CONSULTA_NO_CENTRO', 'VISITA_DOMICILIAR', 'TELEFONE', 'REUNIAO_REDE');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "tipoAgenda" "TipoAgenda" NOT NULL DEFAULT 'FIXA';

-- AlterTable
ALTER TABLE "Aluno" ADD COLUMN "deFora" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ligadoAoAluno" TEXT;

-- AlterTable
ALTER TABLE "Atendimento" ADD COLUMN "avulso" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RegistroConsulta" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipo" "TipoConsulta" NOT NULL,
    "presentes" TEXT,
    "registro" TEXT NOT NULL,
    "encaminhamentos" TEXT[],
    "proximoPasso" TEXT,
    "retornoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "excluidoEm" TIMESTAMP(3),
    "excluidoPor" TEXT,

    CONSTRAINT "RegistroConsulta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistroConsulta_atendimentoId_key" ON "RegistroConsulta"("atendimentoId");

-- AddForeignKey
ALTER TABLE "RegistroConsulta" ADD CONSTRAINT "RegistroConsulta_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "Atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroConsulta" ADD CONSTRAINT "RegistroConsulta_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
