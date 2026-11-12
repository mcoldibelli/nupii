# ADR 0031: Copiar o link da carteirinha com o expo-clipboard

Data: 2026-11-12. Estado: aceito. Este ADR aprova uma dependência no app: `expo-clipboard`.

## Contexto

O tutor cria um link da carteirinha (RF-30) e precisa mandar o link para o veterinário ou para outra pessoa. A folha de compartilhar tinha WhatsApp, e-mail e o compartilhar do sistema, e o link era só um texto selecionável. O responsável pelo produto pediu um jeito fácil de copiar o link (2026-11-12).

O React Native não tem a área de transferência no núcleo desde a versão 0.60.

## Decisão

O app usa o `expo-clipboard`, o módulo oficial do Expo para a área de transferência. A folha de compartilhar tem o botão "Copiar" ao lado do link, e o botão mostra "Copiado" por 2 segundos.

O responsável pelo produto aprovou a dependência em 2026-11-12.

## Alternativas consideradas

- Só o compartilhar do sistema, que tem "Copiar" no Android. Tradeoff: nenhuma dependência nova, mas o tutor precisa de dois toques e procurar a opção numa lista; no iOS a opção fica em outro lugar.
- `navigator.clipboard` na web e o compartilhar no app. Tradeoff: nenhuma dependência nova, mas o comportamento muda entre a web e o app.

## Consequências

- O `expo-clipboard` funciona no Expo Go, no build do app e na web.
- A versão segue o SDK do Expo (`npx expo install`).
