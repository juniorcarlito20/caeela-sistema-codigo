# Sistema de Gestão do CAEELA — código-fonte

Atividade Extensionista · Tecnologia em Análise e Desenvolvimento de Sistemas · Uninter
Aluno: Carlito Rodrigues da Silva Junior · RU 5690974

Sistema web desenvolvido para o **CAEELA — Centro de Atendimento Educacional
Especializado de Licínio de Almeida – BA**. Organiza a agenda dos profissionais,
a presença com assinatura na tela, o prontuário de cada profissional (evolução,
anamnese, documentos), relatórios em PDF timbrado, lembretes por WhatsApp,
ausências da equipe, lixeira de 30 dias, registro de acessos (LGPD) e backup diário.

## Sobre a privacidade dos dados (leia primeiro)

O sistema está **em uso no CAEELA** e guarda dados sensíveis de **crianças com
deficiência**: nomes, CPF, informações de saúde, laudos e evolução terapêutica.
Esses dados são protegidos pela **LGPD (Lei 13.709/2018, art. 11 e art. 14)** e
pelo **ECA (Lei 8.069/1990)**. Por isso:

- o **repositório de trabalho** e o **sistema em produção** são privados e não são divulgados;
- este repositório é uma **cópia pública só do código**, sem histórico, sem senhas e sem nenhum dado real;
- todos os nomes e CPFs dos testes são **inventados**;
- o logo da prefeitura foi trocado por uma marca “DEMONSTRAÇÃO”;
- para ver o sistema funcionando existe uma **versão de demonstração** separada, com
  banco próprio e **dados 100% fictícios** (`src/db/seed-demo.ts`).

As provas de uso real no centro (declaração assinada pela direção, fotos e vídeo)
estão no relatório do Trabalho Final.

## Versão de demonstração

Endereço: https://sistema-production-037f8b1f.up.railway.app
(na primeira abertura pode levar uns 20 segundos para "acordar")

| Perfil | Usuário | Senha |
|---|---|---|
| Direção | `direcao` | `demo2026` |
| Secretaria | `secretaria` | `demo2026` |
| Profissional (Psicologia) | `ana.psicologia` | `demo2026` |

Todos os alunos, profissionais e registros dessa versão são inventados.

## Tecnologias

Next.js 15 (App Router) · TypeScript · Tailwind CSS · PostgreSQL + Prisma ·
Auth.js (login por usuário) · Vitest · @react-pdf/renderer · Railway (hospedagem)

## Rodando local

Pré-requisitos: Node 20+, Docker, `pg_dump` (só para o backup).

```bash
# banco de desenvolvimento
docker run --name caeela-db -e POSTGRES_USER=caeela -e POSTGRES_PASSWORD=caeela \
  -e POSTGRES_DB=caeela -p 5432:5432 -d postgres:16

cp .env.example .env   # e preencha os valores locais
npx prisma migrate dev
npm run seed           # áreas, modelos de anamnese e usuário inicial
npm run dev            # http://localhost:3000
```

## Scripts

| Comando | Para que serve |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm run start` | Build de produção / servir o build |
| `npm test` | Testes (Vitest, sem banco) |
| `npm run lint` | Verificação de código |
| `npm run seed` | Carga inicial (idempotente, pode rodar de novo) |
| `npm run backup` | Dump do banco em `.arquivos/backups/` (precisa de `pg_dump`) |
| `npm run importar -- <agenda.docx> --simular` | Testa a importação sem gravar nada |

## Regras do projeto

- Tudo em português: tela, erro, código e commit.
- Privacidade em primeiro lugar: nenhum dado real de criança no repositório.
  Nomes e CPFs dos testes são fictícios. A pasta `.arquivos/` nunca é versionada.
- Regra de negócio mora em `src/domain/`, em função pura, sempre com teste escrito antes.
- Perfis: `ADMIN` (direção e secretaria, veem tudo) e `PROFISSIONAL` (só os seus alunos
  e só o que ele mesmo escreveu).

