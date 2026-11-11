# ADR 0017: Expo File System para enviar um arquivo do aparelho

Data: 2026-11-11. Estado: aceito. Este ADR aprova uma dependência no app: `expo-file-system`.

## Contexto

O tutor escolhe a foto do pet no aparelho, e o app envia o arquivo para a API em um corpo `multipart/form-data` (RF-10).

O [ADR 0016](0016-navegacao-e-foto-no-app.md) deixou sem verificar o envio do arquivo escolhido. A verificação foi feita no emulador Android, com o Expo SDK 58 no Expo Go:

| Forma de montar a parte do arquivo | Resultado |
|---|---|
| Objeto `{ uri, name, type }` no `FormData`, a forma antiga do React Native | A requisição não sai do app. O `fetch` do Expo SDK 58 não aceita essa forma |
| Objeto `File` do `expo-file-system`, criado com o endereço do arquivo | A API recebe o arquivo e responde 200 |

O `fetch` padrão do Expo SDK 58 monta o corpo a partir de um `Blob` ou de um objeto que entrega os bytes do arquivo. O `File` do `expo-file-system` é esse objeto.

## Decisão

1. O app lê o arquivo escolhido com a classe `File` do `expo-file-system` e põe esse objeto no `FormData`.
2. Só `mobile/src/pets/pickPhoto.ts` importa o `expo-file-system` e o `expo-image-picker`. A chamada da API recebe um `Blob`.

## Alternativas

- Ligar o `fetch` antigo do React Native com a variável `EXPO_PUBLIC_USE_RN_FETCH`. Tradeoff: nenhuma dependência nova, mas o app inteiro deixa de usar o `fetch` padrão da plataforma por causa de uma tela.
- Pedir a imagem em base64 ao seletor e converter para bytes no app. Tradeoff: nenhuma dependência nova, com o arquivo inteiro em texto na memória e um código de conversão para manter.

## Consequência

- O `package.json` do app ganha uma dependência direta. O pacote já estava instalado, porque o próprio `expo` depende dele.
- O teste de unidade da chamada da API usa um `Blob` comum, sem o aparelho.

Referências: [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/), [Expo, fetch](https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api).
