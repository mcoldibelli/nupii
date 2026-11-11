# ADR 0011: Biblioteca de runtime do código gerado pelo oapi-codegen

Data: 2026-11-10. Estado: proposto. Este ADR aprova uma dependência no backend.

## Contexto

O [ADR 0005](0005-contrato-openapi.md) decidiu que o `oapi-codegen` gera os tipos e a interface do servidor em Go, a partir do `api/openapi.yaml`. Ele aprovou o `oapi-codegen` como ferramenta de build.

A verificação que o ADR 0005 deixou aberta foi feita com o `oapi-codegen` v2.8.2 e um contrato mínimo, com um endpoint `GET` e um endpoint de upload `multipart/form-data`:

| Pergunta | Resultado |
|---|---|
| O gerador produz um servidor para o `net/http` da biblioteca padrão? | Sim, com a opção `std-http-server`. As rotas usam o padrão `MÉTODO /caminho/{param}` e `r.PathValue`. |
| O upload `multipart` funciona? | Sim. Um teste enviou um arquivo de 1.234 bytes e o handler leu os 1.234 bytes. |
| O código gerado compila só com a biblioteca padrão? | Não. Ele importa `github.com/oapi-codegen/runtime` (leitura dos parâmetros de caminho) e `github.com/oapi-codegen/runtime/types` (tipos `UUID` e `File`). |

O `go.mod` do teste ficou com `github.com/oapi-codegen/runtime` v1.9.0 e duas dependências indiretas: `github.com/google/uuid` v1.6.0 e `github.com/apapsch/go-jsonmerge/v2` v2.0.0.

Gerar só os tipos (opção `models`) não remove a dependência: um campo de arquivo (`format: binary`) no contrato gera o tipo `types.File`.

Nenhuma dependência entra sem um ADR aceito ([ADR 0001](0001-registrar-decisoes-em-adrs.md)).

## Decisão

1. O backend depende de `github.com/oapi-codegen/runtime`.
2. Só o código gerado e os handlers HTTP importam essa biblioteca. Os tipos de domínio e os serviços de cada módulo não a importam.
3. A versão do `oapi-codegen` e a versão da biblioteca de runtime mudam no mesmo PR.

## Alternativas

- Usar o `oapi-codegen` só para os tipos, e escrever à mão as rotas e a leitura dos parâmetros. Tradeoff: menos código gerado, mas a dependência continua quando o contrato tem upload de arquivo, e as rotas podem ficar diferentes do contrato sem erro de compilação.
- Templates próprios no `oapi-codegen`, que geram código sem a biblioteca. Tradeoff: nenhuma dependência, com templates para manter a cada versão do gerador.
- Sem geração de servidor: tipos e rotas escritos à mão. Tradeoff: nenhuma dependência e nenhuma ferramenta, mas desfaz a decisão do ADR 0005 e deixa a igualdade entre o servidor e o contrato só por conta dos testes.

## Consequência

- O `go.mod` do backend ganha uma dependência direta e duas indiretas.
- Um parâmetro de caminho com formato inválido (exemplo: um UUID errado) recebe 400 do código gerado, antes do handler. Um teste confirmou esse comportamento.
- Os handlers recebem os parâmetros já convertidos, com os tipos da biblioteca (`types.UUID`).

## Não verificado

- O modo `strict-server` gera código que compila com a mesma dependência, mas nenhum teste de comportamento foi executado nesse modo. A escolha entre o modo simples e o modo `strict-server` é feita na tarefa do contrato.

Referências: [oapi-codegen](https://github.com/oapi-codegen/oapi-codegen), [oapi-codegen/runtime](https://pkg.go.dev/github.com/oapi-codegen/runtime).
