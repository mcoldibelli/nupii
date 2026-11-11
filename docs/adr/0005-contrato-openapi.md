# ADR 0005: Contrato da API em OpenAPI, escrito antes do código

Data: 2026-11-10. Estado: aceito. Este ADR aprova duas dependências de build.

## Contexto

A API tem três consumidores: o app, a web pública e os testes. O servidor é Go e os clientes são TypeScript. Com os tipos escritos à mão em cada lado, nada garante que o servidor e os clientes estão iguais (RNF-08).

O contrato precisa existir como um arquivo, que pode ser revisado antes do código.

## Decisão

`api/openapi.yaml` é a fonte do contrato. Ele é escrito e revisado antes do handler.

| Lado | Geração |
|---|---|
| Go | `oapi-codegen` gera os tipos e a interface do servidor |
| TypeScript | `openapi-typescript` gera os tipos usados pelo app e pela web |

Os testes de integração validam as respostas contra o arquivo.

## Alternativas

- Código primeiro: escrever os handlers e gerar o OpenAPI a partir deles. Tradeoff: um passo a menos por endpoint, mas o contrato vira consequência do código e muda sem revisão.
- Sem OpenAPI: tipos escritos à mão nos dois lados. Tradeoff: nenhuma ferramenta, com o risco de divergência entre o servidor e os clientes.
- gRPC ou Connect. Tradeoff: contrato forte por definição, mas a web pública e o upload de fotos ficam mais difíceis.

## Consequência

- Mudar a API começa por um diff no `openapi.yaml`, visível na revisão.
- O CI falha se o código gerado estiver diferente do contrato.
- Cada endpoint tem um passo a mais antes do código.

## Não verificado

- O suporte do `oapi-codegen` ao `net/http` padrão com upload `multipart`. O ADR foi aceito sem essa verificação. Ela é feita na fatia 0.

Referências: [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0), [oapi-codegen](https://github.com/oapi-codegen/oapi-codegen), [openapi-typescript](https://openapi-ts.dev/).
