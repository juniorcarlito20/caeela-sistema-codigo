-- AlterTable
ALTER TABLE "Vinculo" ADD COLUMN     "pausaRetomarEmAntes" TIMESTAMP(3),
ADD COLUMN     "situacaoAlunoAntes" "SituacaoAluno",
ADD COLUMN     "situacaoDesdeAntes" TIMESTAMP(3);
