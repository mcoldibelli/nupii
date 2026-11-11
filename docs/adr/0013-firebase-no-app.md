# ADR 0013: SDK JavaScript do Firebase no app

Data: 2026-11-10. Estado: aceito. Este ADR aprova duas dependências no app.

## Contexto

O [ADR 0008](0008-autenticacao-firebase.md) decidiu que o tutor entra pelo SDK do Firebase no app, e deixou a escolha da biblioteca para a fatia 1.

O que o app precisa da biblioteca nesta fatia:

- Criar conta e entrar com e-mail e senha (RF-01, RF-02), e sair (RF-04).
- Manter a sessão depois de o app ser fechado (RF-02).
- Entregar o ID token para as chamadas da API.
- Ligar no emulador do Authentication no ambiente local ([ADR 0014](0014-emulador-do-firebase-auth.md)).

O app é executado hoje no Expo Go, sem build nativo ([ADR 0006](0006-mobile-expo-web-publica.md)).

## Decisão

1. O app usa o SDK JavaScript do Firebase (pacote `firebase`) para a autenticação.
2. A sessão fica guardada no aparelho com `@react-native-async-storage/async-storage`, que o SDK usa como armazenamento.
3. Só o diretório `mobile/src/auth/` importa o SDK. As telas e as chamadas da API usam as funções desse diretório.

## Alternativas

- React Native Firebase (`@react-native-firebase/app` e `@react-native-firebase/auth`). Tradeoff: usa os SDKs nativos do Android e do iOS, mas é código nativo, e código nativo não é executado no Expo Go: o app passaria a pedir um build de desenvolvimento já nesta fatia.
- Chamar a API REST do Firebase Authentication direto, sem SDK. Tradeoff: nenhuma dependência, mas a renovação do token e o armazenamento da sessão ficam por nossa conta.

## Consequência

- O app continua no Expo Go nesta fatia.
- Quando o app precisar de um build de desenvolvimento (push na fatia 6, ou o detector no aparelho), esta decisão é revista. Trocar de biblioteca muda só `mobile/src/auth/`.
- O login com Google (fatia 10) pode pedir mais uma biblioteca. Ela entra por um ADR novo.

## Não verificado

- O funcionamento do SDK JavaScript com o Expo SDK 58 no Expo Go, inclusive a sessão depois de fechar o app. A verificação é feita na tarefa do app, em um emulador. Se falhar, um ADR novo substitui este.
- A exigência de build de desenvolvimento no React Native Firebase vem do conhecimento geral da biblioteca. A documentação dela não foi lida de novo para este ADR.

Referências: [Firebase, autenticação na Web](https://firebase.google.com/docs/auth/web/start), [Expo, usar o Firebase](https://docs.expo.dev/guides/using-firebase/).
