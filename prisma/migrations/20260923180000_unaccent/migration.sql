-- Busca sem acento ("jose" acha "José"). Extensão padrão do PostgreSQL,
-- sem nenhum serviço extra. Se a extensão não existir no ambiente, a busca
-- cai para a comparação simples (ver src/lib/busca.ts).
CREATE EXTENSION IF NOT EXISTS "unaccent";
