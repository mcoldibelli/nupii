# ADR 0004: pgx e sqlc para consultas, goose para migrations

Data: 2026-11-10. Estado: aceito. Este ADR aprova quatro dependências.

## Contexto

As consultas centrais do sistema são SQL que um ORM não gera: distância com `ST_DWithin` (RN-32), vizinho mais próximo com o operador `<=>` do pgvector (RN-10), e leitura da fila com `SKIP LOCKED` ([ADR 0003](0003-estado-postgres-fila-no-banco.md)).

## Decisão

| Função | Dependência |
|---|---|
| Driver e pool do Postgres | `github.com/jackc/pgx/v5` |
| Código Go gerado a partir do SQL | `sqlc` (ferramenta de build, não entra no binário) |
| Tipo vetor | `github.com/pgvector/pgvector-go` |
| Migrations | `github.com/pressly/goose/v3` |

As consultas ficam em arquivos `.sql` em `backend/db/queries/`. O sqlc gera funções Go com tipos. As migrations ficam em `backend/db/migrations/` e rodam na subida da API.

## Alternativas

- ORM (GORM ou ent). Tradeoff: menos SQL nos cadastros simples, mas as consultas de PostGIS e pgvector continuam em SQL cru. Seriam dois estilos no mesmo projeto.
- `database/sql` com SQL escrito à mão. Tradeoff: nenhuma ferramenta, mas o mapeamento de colunas é manual e os erros só aparecem em execução.
- `golang-migrate` no lugar do goose. Tradeoff: equivalentes para este uso. O goose foi escolhido por permitir migration em Go quando o SQL não basta.

## Consequência

- O SQL é revisado como SQL. Um erro de coluna aparece na geração do código.
- A geração do sqlc é um passo do build. O CI falha se o código gerado estiver diferente do SQL.
- Os tipos de PostGIS precisam de mapeamento manual no sqlc.

## Não verificado

- As versões atuais das quatro dependências e o suporte do sqlc aos tipos `geography` e `vector`. O ADR foi aceito sem essa verificação. Ela é o primeiro passo da fatia 0. Se o sqlc não mapear esses tipos, um ADR novo substitui este.

Referências: [pgx](https://pkg.go.dev/github.com/jackc/pgx/v5), [sqlc](https://docs.sqlc.dev/), [pgvector-go](https://github.com/pgvector/pgvector-go), [goose](https://pressly.github.io/goose/).
