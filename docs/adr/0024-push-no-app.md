# ADR 0024: Push no app com um build de desenvolvimento, na fatia 10

Data: 2026-11-11. Estado: aceito.

## Contexto

RF-23 pede que o app registre o dispositivo do tutor para receber push, e RF-26 pede que cada notificação também saia por push.

O app é executado no Expo Go ([ADR 0006](0006-mobile-expo-web-publica.md), [ADR 0013](0013-firebase-no-app.md)). Desde o Expo SDK 53, o Expo Go não recebe push remoto no Android: o `expo-notifications` só recebe push em um build de desenvolvimento ou no app publicado.

O envio pelo Firebase Cloud Messaging pede a credencial do projeto real do Firebase, que entra pelo roteiro `deploy/firebase-setup.sh`. O ambiente local usa o emulador do Authentication, que não tem o Cloud Messaging.

RN-35 já garante que a notificação existe na lista do app mesmo quando o push não sai.

## Decisão

1. Na fatia 6, a API tem o registro do dispositivo (RF-23) e a tarefa de envio de push (RF-26). O envio usa o Firebase Admin SDK para Go, que já é uma dependência do backend ([ADR 0008](0008-autenticacao-firebase.md)).
2. Sem a credencial do Firebase, a tarefa marca a notificação como não enviada e não chama o Cloud Messaging (RN-36).
3. O app recebe as notificações pela lista (RF-25), no Expo Go. O registro do dispositivo no app e o recebimento do push entram na fatia 10, com o build do app, e a dependência `expo-notifications` entra por um ADR novo nessa fatia.
4. Os testes da tarefa de push usam um envio falso.

## Alternativas

- Build de desenvolvimento já na fatia 6. Tradeoff: o push é verificado em um aparelho agora, mas o projeto passa a pedir o EAS ou o Android Studio para cada mudança nativa, e o projeto real do Firebase antes da publicação.
- Serviço de push do Expo (Expo Push Service). Tradeoff: um envio só para Android e iOS, mas é mais um serviço de fora, com uma conta do Expo, e ele também pede um build de desenvolvimento para o push remoto.

## Consequência

- Na fatia 6, o tutor vê o alerta quando abre o app. Ele não recebe o aviso com o app fechado.
- O critério da fatia 6 é verificado pela lista de notificações.
- A fatia 10 liga o push de ponta a ponta: o projeto real do Firebase, o build do app e o `expo-notifications`.

## Não verificado

- O envio real pelo Cloud Messaging. Ele é verificado na fatia 10, com a credencial do projeto real.

Referências: [Expo, notificações](https://docs.expo.dev/versions/latest/sdk/notifications/), [Firebase Admin SDK, Cloud Messaging](https://firebase.google.com/docs/cloud-messaging/send-message).
