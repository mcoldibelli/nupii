# ADR 0015: Cliente do armazenamento de objetos com a biblioteca padrão

Data: 2026-11-11. Estado: aceito.

## Contexto

O [ADR 0003](0003-estado-postgres-fila-no-banco.md) decidiu que fotos e anexos ficam em um armazenamento de objetos compatível com S3. Ele não escolheu o cliente que o backend usa.

O que a API precisa do armazenamento nesta fatia e nas próximas conhecidas:

- Gravar um objeto pequeno (uma foto de até 5 MB, RN-54).
- Apagar um objeto (RN-05, RN-55).
- Gerar uma URL temporária de leitura (RN-06).

As três operações cabem em um mecanismo só do protocolo S3: a URL pré-assinada (Signature Version 4 nos parâmetros da URL). Com uma URL pré-assinada de `PUT`, de `DELETE` ou de `GET`, a requisição é um pedido HTTP comum, sem cabeçalho de assinatura.

Cada dependência do backend precisa de um ADR ([ADR 0001](0001-registrar-decisoes-em-adrs.md)).

## Medida

A assinatura foi escrita com a biblioteca padrão do Go (`crypto/hmac`, `crypto/sha256`, `net/url`), em cerca de 40 linhas.

| Teste | Resultado |
|---|---|
| Exemplo da documentação da AWS para URL pré-assinada (bucket, chave, data e validade fixos) | A assinatura gerada é igual à assinatura do exemplo |
| SeaweedFS 4.53: `PUT` de 3.000 bytes com chave que tem espaço e acento | 200 |
| SeaweedFS: `GET` do mesmo objeto | 200, mesmo conteúdo e mesmo `Content-Type` |
| SeaweedFS: `GET` com uma URL assinada para `PUT` | 403 |
| SeaweedFS: `DELETE`, e `GET` depois | 204, depois 404 |

## Decisão

1. O backend fala com o armazenamento de objetos por URLs pré-assinadas, geradas com a biblioteca padrão do Go. Nenhum SDK de S3 entra no backend.
2. O código fica em `platform/storage`, com três operações: gravar, apagar e gerar a URL temporária de leitura.
3. A URL temporária que vai para o cliente é assinada com o endereço público do armazenamento. As operações da própria API usam o endereço interno. Os dois endereços vêm da configuração.
4. Os testes de `platform/storage` são de integração, contra o servidor S3 do compose: o servidor confere a assinatura.

## Alternativas

- SDK da AWS para Go (`aws-sdk-go-v2`, módulo `service/s3`). Tradeoff: cliente oficial e completo, com upload em partes, novas tentativas e todas as operações, com cerca de dez módulos a mais no binário. As três operações deste sistema não usam nada disso.
- `minio-go`. Tradeoff: cliente menor que o da AWS e feito para servidores compatíveis, mas é mais uma dependência para o mesmo resultado, e vem do mesmo projeto cujo servidor deixou de ter manutenção ([ADR 0012](0012-servidor-s3-local.md)).

## Consequência

- O backend não ganha dependência para o armazenamento.
- A assinatura é código nosso: um erro nela aparece como 403 do servidor. Os testes de integração cobrem as três operações.
- Um objeto é enviado em uma requisição só. Isso serve para fotos e anexos pequenos.
- Gatilho para trocar por um SDK: upload em partes, envio direto do app para o armazenamento com condições, ou uma operação além das três. A troca muda só `platform/storage`.

## Não verificado

- O serviço de armazenamento da produção. Ele é escolhido na fatia 10, e a tarefa de publicação repete os testes contra o serviço real.
- O exemplo da documentação da AWS foi conferido em uma execução local, e não é um teste versionado: as credenciais de exemplo da AWS têm o formato de chaves reais e seriam apontadas por um verificador de segredos.

Referências: [AWS, autenticação por parâmetros da URL (Signature Version 4)](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html), [SeaweedFS, API do Amazon S3](https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API).
