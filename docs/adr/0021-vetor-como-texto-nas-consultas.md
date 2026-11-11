# ADR 0021: Vetor como texto nas consultas, sem a biblioteca pgvector-go

Data: 2026-11-11. Estado: aceito. Este ADR substitui a linha "Tipo vetor" do [ADR 0004](0004-acesso-a-dados.md).

## Contexto

O [ADR 0004](0004-acesso-a-dados.md) escolheu a biblioteca `pgvector-go` para o tipo `vector` no Go. Com ela, cada conexão do pool registra o tipo, e o registro só funciona depois de a extensão existir no banco.

A API abre o pool antes de aplicar as migrations, e a primeira migration cria a extensão. Em um banco novo, o registro do tipo falharia na primeira conexão.

O que o backend faz com um vetor:

- Grava o vetor que o serviço de inferência devolveu (RF-11).
- Passa um vetor como parâmetro da busca (RF-12).

O backend nunca lê um vetor do banco. A busca devolve a similaridade, um número.

## Decisão

1. Um vetor vai para o banco como texto, no formato do pgvector (`[0.1,0.2,...]`), e a consulta converte com `::text::vector`.
2. O `sqlc` gera um parâmetro `string` para esse valor. A função que monta o texto fica no módulo `biometrics`.
3. A biblioteca `pgvector-go` não entra no backend.

## Alternativas

- `pgvector-go` com registro em cada conexão. Tradeoff: um tipo Go para o vetor, com dois módulos a mais e uma ordem obrigatória na subida: migrations antes do pool.

## Consequência

- O backend não ganha dependência para o vetor, e a ordem da subida não muda.
- O texto de um vetor de 512 dimensões tem cerca de 6 KB por consulta.
- Gatilho para rever: o backend precisar ler um vetor do banco.

## Não verificado

- O custo da conversão de texto em um acervo grande. A medida é feita se a identificação ficar lenta.

Referência: [pgvector, formato de texto do tipo `vector`](https://github.com/pgvector/pgvector#getting-started).
