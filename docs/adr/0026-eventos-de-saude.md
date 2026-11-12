# ADR 0026: Eventos de saúde em uma tabela, e próximos cuidados calculados pela API

Data: 2026-11-11. Estado: aceito. Este ADR aprova uma dependência no app: `expo-document-picker`.

## Contexto

RF-27 traz cinco tipos de evento de saúde: vacina, consulta, medicação, exame e anotação. Os tipos têm uma parte comum (o pet, a data, as observações, os anexos) e campos próprios. RF-29 pede lembretes de vacina e de medicação. O roteiro deixou duas decisões para esta fatia: a modelagem dos eventos e o lugar do cálculo do lembrete.

O app é executado no Expo Go e não recebe push ([ADR 0024](0024-push-no-app.md)). A carteirinha da fatia 8 mostra os eventos de todos os tipos em uma lista.

Um anexo de exame é muitas vezes um PDF. O seletor de imagem do app ([ADR 0016](0016-navegacao-e-foto-no-app.md)) escolhe só fotos.

## Decisão

1. Os eventos ficam em uma tabela `health_events`, com o tipo e as colunas próprias de cada tipo, opcionais. Uma restrição `CHECK` por tipo garante os campos obrigatórios dele.
2. O contrato tem um esquema `HealthEvent`, com o campo `type` e os campos de cada tipo, opcionais. A API confere os campos de cada tipo.
3. A API calcula os próximos cuidados: a data da próxima dose de uma vacina, e a data de uma medicação em uso somada ao intervalo em dias. O app mostra a lista. O push dos lembretes entra na fatia 10, com o push do app, a partir do mesmo cálculo.
4. Um anexo é uma imagem JPEG, PNG ou WebP, ou um PDF. O app escolhe o arquivo com o `expo-document-picker`.

## Alternativas

- Uma tabela por tipo, com uma tabela comum. Tradeoff: cada tipo com as próprias colunas obrigatórias no banco, mas a lista e a carteirinha juntam cinco tabelas, e o contrato precisa de `oneOf`, que o gerador de código do Go trata mal.
- O cálculo do lembrete no app. Tradeoff: nenhuma operação a mais na API, mas a regra fica só no app, e o push da fatia 10 precisaria da mesma regra no backend.
- Anexo só de imagem. Tradeoff: nenhuma dependência nova, mas o resultado de um exame em PDF não entra.

## Consequência

- Uma linha tem colunas vazias dos outros tipos. A API confere que um campo de outro tipo não chega preenchido.
- A lista de eventos, a carteirinha e os próximos cuidados leem uma tabela.

## Não verificado

- O `expo-document-picker` no Expo Go com o Expo SDK 58. A verificação é feita na tarefa do app.

Referências: [Expo DocumentPicker](https://docs.expo.dev/versions/latest/sdk/document-picker/), [PostgreSQL, restrições CHECK](https://www.postgresql.org/docs/current/ddl-constraints.html).

## Verificação posterior

2026-11-11, na tarefa do app, no emulador Android com o Expo Go:

| Teste | Resultado |
|---|---|
| Seletor com a cópia para o cache (`copyToCacheDirectory: true`) | O arquivo não é lido: o `expo-file-system` do Expo Go recusa a cópia, que fica fora da pasta do app ("FileSystemFile.bytes has been rejected") |
| Seletor sem a cópia (`copyToCacheDirectory: false`) | O endereço `content://` do Android é lido, e a API recebe o PDF |
| Nome do arquivo | O `fetch` do Expo envia o nome do objeto do arquivo, e não o nome dado ao `FormData`. O app envia o nome no campo `fileName` |
| Criar, editar e apagar os cinco tipos de evento | Os cinco tipos passam |

Continua sem verificação: o seletor no iOS e em um aparelho real.
