# ADR 0020: Leitura de um objeto do armazenamento pelo backend

Data: 2026-11-11. Estado: aceito.

## Contexto

O [ADR 0015](0015-cliente-de-armazenamento.md) deu três operações ao cliente do armazenamento: gravar, apagar e gerar a URL temporária de leitura. Ele pôs um gatilho: uma operação além das três pede uma nova avaliação de um SDK de S3.

O recálculo dos vetores (RF-15) parte da foto guardada do focinho. Então o backend precisa ler o conteúdo de um objeto.

## Decisão

1. O cliente de `platform/storage` ganha a operação de ler um objeto.
2. A leitura usa o mesmo mecanismo das outras operações: uma URL pré-assinada de `GET`, com o endereço interno do armazenamento, e um pedido HTTP comum.
3. O conteúdo lido tem um tamanho máximo, dado por quem chama. A foto do focinho tem até 8 MB (RN-17).
4. Nenhum SDK entra no backend. O gatilho do ADR 0015 continua para upload em partes e para envio direto do app.

## Alternativas

- SDK da AWS para Go, só para a leitura. Tradeoff: nenhuma linha de assinatura a mais, com cerca de dez módulos no binário para um `GET`.
- Guardar o vetor de todas as versões do modelo e não ler a foto. Tradeoff: nenhuma leitura do armazenamento, mas um vetor de uma versão nova só existe depois de a rede nova ler a foto.

## Consequência

- A assinatura de `GET` já existe para a URL temporária. A operação nova reusa essa assinatura.
- Os testes de integração de `platform/storage` cobrem a leitura contra o servidor S3 do compose.

Referência: [AWS, autenticação por parâmetros da URL (Signature Version 4)](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html).
