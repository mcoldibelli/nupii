# ADR 0016: Navegação com Expo Router e seleção de foto com Expo Image Picker

Data: 2026-11-11. Estado: aceito. Este ADR aprova dependências no app: `expo-router`, os pacotes que ele exige, e `expo-image-picker`.

## Contexto

Até a fatia 1, o app tem três telas e escolhe a tela por um estado em `App.tsx`. A fatia 2 traz lista, criar e editar pet (RF-09), com ida e volta entre as telas e o botão de voltar do Android. As fatias seguintes trazem mais telas.

O tutor escolhe a foto de perfil do pet no aparelho (RF-10).

O app é executado no Expo Go ([ADR 0006](0006-mobile-expo-web-publica.md)). A hipótese de partida do ADR 0006 é a web pública sair do mesmo projeto Expo, e a web precisa de um endereço por tela.

## Decisão

1. A navegação do app usa o `expo-router`: cada arquivo do diretório `mobile/app/` é uma tela, e o caminho do arquivo é a rota.
2. Entram com ele os pacotes que a instalação do `expo-router` pede. A lista exata fica no `package.json` e é a que o comando `npx expo install` instala para a versão do Expo SDK.
3. A seleção de foto usa o `expo-image-picker`, com a galeria do aparelho.
4. As regras de negócio e as chamadas da API continuam em `mobile/src/`, sem importar a navegação.

## Alternativas

Para a navegação:

- React Navigation direto (`@react-navigation/native` e `native-stack`). Tradeoff: menos convenção e a mesma base de navegação, mas as rotas são declaradas em código e a web não ganha um endereço por tela sem configuração a mais.
- Continuar com o estado em `App.tsx`. Tradeoff: nenhuma dependência, mas a pilha de telas, o botão de voltar e os parâmetros de rota passam a ser código nosso.

Para a foto:

- `expo-camera`, com uma tela de câmera própria. Tradeoff: controle da captura, com mais código. A galeria do aparelho já oferece a câmera. A câmera com guia entra na biometria (fatia 4).

## Consequência

- O ponto de entrada do app muda para o `expo-router`, e `App.tsx` dá lugar ao diretório `mobile/app/`.
- A sessão e o tutor ficam disponíveis para todas as telas por um contexto do React, criado no layout raiz.
- Os dois pacotes funcionam no Expo Go, então o app continua sem build de desenvolvimento nesta fatia.

## Não verificado

- O funcionamento do `expo-router` e do `expo-image-picker` com o Expo SDK 58 no Expo Go. A verificação é feita na tarefa do app, em um emulador. Se falhar, um ADR novo substitui este.
- O envio do arquivo escolhido para a API a partir do app.

Referências: [Expo Router](https://docs.expo.dev/router/introduction/), [Expo Image Picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/).
