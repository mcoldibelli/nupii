# ADR 0010: Ferramentas de teste

Data: 2026-11-10. Estado: proposto. Este ADR aprova seis dependências de teste. Nenhuma entra no binário da API, no app publicado ou na imagem do serviço de inferência.

## Contexto

- Toda regra de negócio tem um teste que cita o identificador dela (RNF-09).
- As consultas de PostGIS, de pgvector e da fila de tarefas só podem ser testadas em um Postgres real ([arquitetura.md](../arquitetura.md), seção "Testes").
- Os testes de integração validam as respostas contra o `api/openapi.yaml` ([ADR 0005](0005-contrato-openapi.md), RNF-08).
- Nenhuma dependência entra sem um ADR aceito ([ADR 0001](0001-registrar-decisoes-em-adrs.md)). As ferramentas de teste ainda não estão em nenhum ADR.

Os pacotes `testing` e `net/http/httptest` do Go são da biblioteca padrão e não precisam de aprovação.

## Decisão

| Projeto | Nível | Ferramenta |
|---|---|---|
| backend | Unidade | `testing` e `net/http/httptest`, da biblioteca padrão |
| backend | Integração | O Postgres do compose do repositório. O endereço do banco chega por variável de ambiente. Sem biblioteca. |
| backend | Contrato | `github.com/getkin/kin-openapi`, pacote `openapi3filter`, importado só em arquivos `_test.go` |
| mobile | Unidade | `jest`, com o preset `jest-expo` e os tipos `@types/jest` |
| inference | Unidade e HTTP | `pytest`, e `httpx` (o `TestClient` do FastAPI precisa dele) |

Regras:

1. Os testes de integração do backend têm a build tag `integration`. `go test ./...` executa só os testes de unidade. `go test -tags=integration ./...` executa todos.
2. Um teste de integração sem banco falha. Ele não é pulado.
3. Cada teste de integração de um handler valida a resposta com `openapi3filter.ValidateResponse` contra o `api/openapi.yaml`.

## Alternativas

- `testcontainers-go` para subir o Postgres dentro do teste. Tradeoff: o teste não depende de um compose em execução, com uma dependência a mais e um segundo modo de subir o banco. O compose já existe para o ambiente local e para o CI.
- Contrato só pelos tipos gerados, sem validador. Tradeoff: nenhuma dependência, mas os tipos não conferem formatos, campos obrigatórios e códigos de status contra o arquivo. O ADR 0005 pede a validação contra o arquivo.
- `unittest` da biblioteca padrão do Python no lugar do `pytest`. Tradeoff: uma dependência a menos, mas a documentação do FastAPI usa o `pytest`, e o `httpx` continua necessário.
- `@testing-library/react-native` para testes de componente. Fica fora: a estratégia de testes do app cobre lógica pura e chamadas da API. Um ADR novo aprova a biblioteca se a estratégia mudar.

## Consequência

- Executar os testes de integração pede o compose em execução. O CI sobe o compose antes desses testes.
- O `kin-openapi` aparece no `go.mod`, mas não entra no binário da API: nenhum arquivo fora de `_test.go` o importa. O CI confere isso.
- O contrato é lido pelo `oapi-codegen` na geração e pelo `kin-openapi` nos testes. Uma construção do OpenAPI que um dos dois não aceita não pode ser usada no contrato.

## Não verificado

- Se o preset `jest-expo` funciona com a versão do Expo SDK do projeto. A verificação é feita na tarefa que cria o app.
- Se o `openapi3filter` valida o corpo de uma resposta que não é JSON. Hoje o contrato só tem respostas JSON.

Referências: [Go, pacote testing](https://pkg.go.dev/testing), [kin-openapi, openapi3filter](https://pkg.go.dev/github.com/getkin/kin-openapi/openapi3filter), [Expo, testes de unidade com Jest](https://docs.expo.dev/develop/unit-testing/), [FastAPI, testes](https://fastapi.tiangolo.com/tutorial/testing/), [pytest](https://docs.pytest.org/).
