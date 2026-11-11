# ADR 0012: SeaweedFS como servidor S3 do ambiente local

Data: 2026-11-10. Estado: aceito. Este ADR aprova uma imagem de container para o ambiente local e para o CI. Ele substitui uma parte do [ADR 0003](0003-estado-postgres-fila-no-banco.md): o servidor S3 do ambiente local. O resto do ADR 0003 continua válido.

## Contexto

O ADR 0003 decidiu que fotos e anexos ficam em um armazenamento de objetos compatível com S3, com o MinIO no ambiente local.

Em 2026-11-10 o MinIO não pode mais ser usado assim:

- O repositório `minio/minio` foi arquivado em 2026-04-25, com o aviso "THIS REPOSITORY IS NO LONGER MAINTAINED". A última versão é de 2025-10-16.
- O repositório `minio/minio` do Docker Hub não existe mais.

O que o sistema precisa do servidor do ambiente local:

- As operações `PutObject`, `GetObject` e `DeleteObject`.
- URL temporária de leitura (RN-06), com a assinatura e a validade conferidas pelo servidor. Sem essa conferência, um teste de URL temporária no ambiente local não prova nada.
- Um container no compose, em linux/arm64 e em linux/amd64.
- Bucket e chave de acesso criados na subida, sem um passo manual.

O servidor do ambiente local não vai para a produção. A produção usa um serviço compatível com S3, escolhido na fatia 10.

## Medida

O SeaweedFS 4.53 foi executado em um container (linux/arm64), com um bucket e uma chave criados por variáveis de ambiente. As URLs foram assinadas com SigV4.

| Teste | Resultado |
|---|---|
| Envio de um arquivo de 1.234 bytes por URL assinada | 200 |
| Leitura por URL assinada | 200, com o mesmo conteúdo |
| Leitura sem assinatura | 403 |
| Leitura com a assinatura alterada | 403 |
| Leitura com URL assinada por outro segredo | 403 |
| Leitura depois do fim da validade (2 segundos) | 403 |
| Exclusão por URL assinada, e leitura depois da exclusão | 204, depois 404 |

O servidor ficou pronto em 5 segundos e usou 74 MiB de memória em repouso. A imagem tem 270 MB.

## Decisão

1. O ambiente local e o CI usam o SeaweedFS, com a imagem `chrislusf/seaweedfs` em uma versão fixa (4.53 nesta data), em um container, no modo padrão da imagem.
2. O bucket e a chave de acesso são criados na subida pelas variáveis `S3_BUCKET`, `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`.
3. A API usa só operações do protocolo S3. Nenhum código depende de uma função própria do SeaweedFS.

## Alternativas

Todas têm versão publicada nos últimos seis meses e imagem oficial para arm64 e amd64, exceto onde o texto diz o contrário.

- Garage. Tradeoff: cria bucket e chave por variáveis, mas pede um arquivo de configuração montado no container. Licença AGPL-3.0.
- Silo, um fork do MinIO. Tradeoff: é o mais próximo do plano original, mas o bucket é criado por um comando depois da subida. Licença AGPL-3.0.
- RustFS. Tradeoff: licença Apache-2.0, mas a documentação lida não tem uma forma de criar o bucket na subida.
- Versity S3 Gateway. Tradeoff: licença Apache-2.0, mas o armazenamento em disco pede um sistema de arquivos com atributos estendidos ou uma opção a mais.
- Adobe S3Mock. Rejeitado: a documentação diz que ele aceita uma URL assinada sem conferir a assinatura e a validade.
- LocalStack. Rejeitado: o container só sobe com um token de uma conta, e o plano gratuito é para uso não comercial.
- A última imagem do MinIO. Rejeitada: não tem manutenção e não está mais no Docker Hub.

## Consequência

- A documentação e o compose citam o SeaweedFS no lugar do MinIO.
- O container executa mais do que o serviço S3: ele também sobe os outros componentes do SeaweedFS no mesmo processo. Só a porta do S3 é publicada no compose.
- A documentação do SeaweedFS avisa que os valores padrão desse modo podem mudar entre versões. Por isso a versão da imagem é fixa.
- Uma diferença entre o SeaweedFS e o serviço S3 da produção só aparece na publicação. A tarefa de publicação repete o teste de envio e de URL temporária contra o serviço real.

## Não verificado

- A execução em linux/amd64. O CI faz essa verificação.
- Se os dados continuam no volume depois de o container reiniciar.
- Se uma URL assinada para o endereço do servidor dentro do compose abre a partir do app. A tarefa da foto do pet (fatia 2) trata o endereço público do armazenamento.

Referências: [SeaweedFS, README da versão 4.53](https://github.com/seaweedfs/seaweedfs/blob/4.53/README.md), [SeaweedFS, API do Amazon S3](https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API), [repositório minio/minio](https://github.com/minio/minio).
