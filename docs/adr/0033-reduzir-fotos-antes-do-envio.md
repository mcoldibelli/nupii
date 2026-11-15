# ADR 0033: Reduzir as fotos de perfil e de achado antes do envio

Data: 2026-11-13. Estado: aceito. Este ADR aprova uma dependência no app: `expo-image-manipulator`.

## Contexto

A revisão de desempenho do app (#246, P4) achou que a foto de perfil do pet e a foto do cachorro achado sobem na resolução da câmera ou da galeria. O lugar maior que mostra uma dessas fotos tem cerca de 1200 px de largura (a largura de um celular em 3x). O `expo-image-picker` comprime o JPEG, mas não muda a resolução.

A foto do focinho era outra coisa: o detector precisava dela sem nova compressão (item 3 tem a mudança de #298).

## Decisão

1. O app usa o `expo-image-manipulator`, o módulo oficial do Expo para mudar imagens, com a API `ImageManipulator.manipulate(...).resize(...).renderAsync()`.
2. A foto de perfil (câmera ou galeria) e a foto do cachorro achado sobem com o lado maior em no máximo 1600 px, em JPEG com qualidade 0,8 (`shrinkPhoto`). Uma foto menor sobe como está.
3. A foto do focinho não passa por essa redução. Mudou com o [ADR 0036](0036-vetor-do-recorte-do-focinho.md) (#298): a foto do focinho agora é do rosto, e o serviço recorta o focinho; ela passa pela mesma redução, com lado maior de até 3000 px e JPEG 0,9 (`nosePhoto`). Sem isso, uma foto HEIC da galeria do iPhone, ou uma foto de 48 MP, era recusada. A galeria pede a representação compatível (JPEG) no iPhone.
4. Só `mobile/src/pets/pickPhoto.ts` importa o pacote, como o seletor de imagens.

O responsável pelo produto aprovou a dependência em 2026-11-13.

## Alternativas consideradas

- Reduzir no servidor. Tradeoff: nenhuma dependência no app, mas o arquivo inteiro ainda sobe pela rede móvel, que é o custo que a revisão achou.
- Só baixar a qualidade do JPEG no seletor. Tradeoff: nenhuma dependência nova, mas a resolução continua a da câmera, e o arquivo continua grande.

## Consequências

- Uma foto de 4000 × 3000 da galeria do emulador subiu com 1600 × 1200 e 82.727 bytes (a original tinha 575.052 bytes).
- O pacote funciona no Expo Go, no build do app e na web.
- A versão segue o SDK do Expo (`npx expo install`).
