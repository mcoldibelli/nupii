# ADR 0025: Localização do aparelho com Expo Location

Data: 2026-11-11. Estado: aceito. Este ADR aprova uma dependência no app: `expo-location`.

## Contexto

RF-22 pede que o app envie a localização do tutor para a API. O alerta de proximidade usa a última localização (RN-30, RN-32).

O app é executado no Expo Go ([ADR 0006](0006-mobile-expo-web-publica.md)). O React Native não tem mais a API `navigator.geolocation` no núcleo.

## Medida

No emulador Android, com o Expo Go:

| Teste | Resultado |
|---|---|
| Pedido de permissão | O Android mostra o pedido, com "Enquanto o app está em uso" |
| Posição com precisão equilibrada | Erro "Current location is unavailable": o emulador não tem localização pela rede |
| Posição com precisão alta, com um ponto de GPS no emulador | A API recebe a posição, a 1.108 m do ponto de um desaparecimento |

## Decisão

1. O app usa o `expo-location`, com a permissão de uso enquanto o app está aberto.
2. O app envia a posição uma vez, quando a lista de pets abre. Ele pede a posição com precisão alta (GPS).
3. Só `mobile/src/alerts/deviceLocation.ts` importa o pacote. A regra do envio fica em `mobile/src/alerts/location.ts`, com testes.
4. Sem a permissão, o app continua e o tutor não recebe alertas de proximidade.

## Alternativas

- `@react-native-community/geolocation`. Tradeoff: o mesmo resultado, com um pacote fora do Expo e sem a configuração do Expo Go.
- Localização em segundo plano. Tradeoff: o alerta usa uma posição mais nova, mas pede a permissão de segundo plano e um build de desenvolvimento. A v1 usa a posição da última vez que o app abriu.

## Consequência

- A posição fica velha quando o tutor não abre o app. RN-30 já diz que vale a última localização.
- A precisão alta usa o GPS e pode levar alguns segundos a mais em um ambiente fechado.

## Não verificado

- A posição em um aparelho real e no iOS.

Referência: [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/).
