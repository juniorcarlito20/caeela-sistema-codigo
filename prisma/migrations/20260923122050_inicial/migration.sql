-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMIN', 'PROFISSIONAL');

-- CreateEnum
CREATE TYPE "SituacaoAluno" AS ENUM ('ESPERA', 'ATENDIMENTO', 'PAUSA', 'ALTA', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "SituacaoAtendimento" AS ENUM ('AGENDADO', 'REALIZADO', 'FALTOU', 'JUSTIFICOU');

-- CreateEnum
CREATE TYPE "TipoRelatorio" AS ENUM ('ACOMPANHAMENTO', 'PAUSA', 'ALTA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "email" TEXT,
    "senhaHash" TEXT NOT NULL,
    "precisaTrocarSenha" BOOLEAN NOT NULL DEFAULT true,
    "perfil" "Perfil" NOT NULL DEFAULT 'PROFISSIONAL',
    "areaId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aluno" (
    "id" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "nascimento" TIMESTAMP(3),
    "escola" TEXT,
    "serie" TEXT,
    "responsavel" TEXT,
    "whatsapp" TEXT,
    "observacoes" TEXT,
    "situacao" "SituacaoAluno" NOT NULL DEFAULT 'ESPERA',
    "excluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vinculo" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),

    CONSTRAINT "Vinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Horario" (
    "id" TEXT NOT NULL,
    "vinculoId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "hora" TEXT NOT NULL,
    "duracaoMin" INTEGER NOT NULL DEFAULT 40,
    "emGrupo" BOOLEAN NOT NULL DEFAULT false,
    "grupo" TEXT,
    "vigenteAte" TIMESTAMP(3),

    CONSTRAINT "Horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atendimento" (
    "id" TEXT NOT NULL,
    "vinculoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL,
    "situacao" "SituacaoAtendimento" NOT NULL DEFAULT 'AGENDADO',
    "assinaturaId" TEXT,
    "assinadoEm" TIMESTAMP(3),
    "dispositivo" TEXT,

    CONSTRAINT "Atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evolucao" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "atividade" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloAnamnese" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "areaId" TEXT,
    "campos" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ModeloAnamnese_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anamnese" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "respostas" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anamnese_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "enviadoPor" TEXT NOT NULL,
    "excluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relatorio" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipo" "TipoRelatorio" NOT NULL,
    "texto" TEXT NOT NULL,
    "pdfChave" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Relatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lembrete" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "enviadoEm" TIMESTAMP(3),
    "confirmadoEm" TIMESTAMP(3),

    CONSTRAINT "Lembrete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAcesso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "alvo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL DEFAULT 'unica',
    "instituicao" TEXT NOT NULL DEFAULT 'CAEELA',
    "logoChave" TEXT,
    "corPrimaria" TEXT NOT NULL DEFAULT '#1766c9',
    "corSecundaria" TEXT NOT NULL DEFAULT '#2ea84a',
    "endereco" TEXT,
    "email" TEXT,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_usuario_key" ON "Usuario"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Area_nome_key" ON "Area"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Aluno_matricula_key" ON "Aluno"("matricula");

-- CreateIndex
CREATE INDEX "Vinculo_alunoId_fim_idx" ON "Vinculo"("alunoId", "fim");

-- CreateIndex
CREATE INDEX "Vinculo_profissionalId_fim_idx" ON "Vinculo"("profissionalId", "fim");

-- CreateIndex
CREATE INDEX "Atendimento_data_idx" ON "Atendimento"("data");

-- CreateIndex
CREATE UNIQUE INDEX "Atendimento_vinculoId_data_hora_key" ON "Atendimento"("vinculoId", "data", "hora");

-- CreateIndex
CREATE UNIQUE INDEX "Evolucao_atendimentoId_key" ON "Evolucao"("atendimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloAnamnese_nome_key" ON "ModeloAnamnese"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Lembrete_atendimentoId_key" ON "Lembrete"("atendimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "Lembrete_token_key" ON "Lembrete"("token");

-- CreateIndex
CREATE INDEX "RegistroAcesso_criadoEm_idx" ON "RegistroAcesso"("criadoEm");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vinculo" ADD CONSTRAINT "Vinculo_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vinculo" ADD CONSTRAINT "Vinculo_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vinculo" ADD CONSTRAINT "Vinculo_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horario" ADD CONSTRAINT "Horario_vinculoId_fkey" FOREIGN KEY ("vinculoId") REFERENCES "Vinculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atendimento" ADD CONSTRAINT "Atendimento_vinculoId_fkey" FOREIGN KEY ("vinculoId") REFERENCES "Vinculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolucao" ADD CONSTRAINT "Evolucao_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "Atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolucao" ADD CONSTRAINT "Evolucao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeloAnamnese" ADD CONSTRAINT "ModeloAnamnese_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anamnese" ADD CONSTRAINT "Anamnese_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anamnese" ADD CONSTRAINT "Anamnese_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anamnese" ADD CONSTRAINT "Anamnese_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "ModeloAnamnese"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lembrete" ADD CONSTRAINT "Lembrete_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "Atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAcesso" ADD CONSTRAINT "RegistroAcesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
