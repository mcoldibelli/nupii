# ADR 0023: Mapa com Leaflet e OpenStreetMap

Data: 2026-11-11. Estado: aceito. Este ADR aprova uma dependência no app: `react-native-webview`. O Leaflet não entra no pacote do app nem da web: a página do mapa carrega o Leaflet de um CDN.

## Contexto

A fatia 5 traz o mapa: o tutor marca o ponto do desaparecimento (RF-18), quem encontrou marca o ponto do achado (RF-19), quem viu marca o ponto do avistamento (RF-20), e a ficha mostra os pontos (RF-17).

O mapa existe no app (Expo Go, Android e iOS) e na web pública ([ADR 0022](0022-web-publica-no-alvo-web-do-expo.md)). A web pública tem um orçamento de 500 KB de JavaScript com gzip, e a página "encontrei um pet" já usa 363 KB.

O [ADR 0006](0006-mobile-expo-web-publica.md) tem um critério para o mapa na web: o mapa aparece e aceita a escolha de um ponto.

A biblioteca precisa ser de código aberto. A v1 não tem fins lucrativos.

## Medida

Leaflet 1.9.4 (licença BSD-2-Clause), com os quadros do mapa do OpenStreetMap, em uma página de teste, no Chrome com a tela de um Pixel 7:

| Teste | Resultado |
|---|---|
| O mapa aparece | 12 quadros do OpenStreetMap carregados, todos com 200 |
| Toque no mapa | O marcador aparece no ponto, e a página lê a latitude e a longitude |
| Tamanho do Leaflet | `leaflet.js` 144 KB (41 KB com gzip), `leaflet.css` 14 KB (3 KB com gzip) |

## Decisão

1. O mapa usa o Leaflet 1.9.4, com os quadros do OpenStreetMap.
2. O mapa é uma página HTML, gerada pelo app a partir dos pontos. Ela carrega o Leaflet do `unpkg.com`, com versão exata e o hash SHA-256 do arquivo (`integrity`).
3. No app, a página fica em um `WebView` (`react-native-webview`). Na web, a página fica em um `iframe`. A página envia o ponto escolhido para a tela por mensagem.
4. O código do mapa fica em `mobile/src/map/`. As telas recebem só os pontos.
5. O mapa mostra a atribuição do OpenStreetMap, como pede a licença dos dados.

## Alternativas

- `react-native-maps`. Tradeoff: mapa nativo, já incluído no Expo Go, mas no Android ele usa o Google Maps, que pede uma chave e não é código aberto, e ele não tem alvo web.
- MapLibre (`@maplibre/maplibre-react-native` e `maplibre-gl`). Tradeoff: mapa vetorial de código aberto, mas o pacote nativo pede um build de desenvolvimento, e o `maplibre-gl` tem cerca de 200 KB com gzip, o que passa do orçamento da web pública.
- Leaflet no pacote da web, com `react-leaflet`. Tradeoff: sem CDN, mas 41 KB a mais em cada página pública e dois códigos de mapa, um para a web e outro para o app.

## Consequência

- O orçamento de JavaScript da web pública não muda: o Leaflet é carregado só dentro do `iframe` do mapa.
- O mapa depende de dois serviços de fora: o `unpkg.com` para o Leaflet e o `tile.openstreetmap.org` para os quadros. Sem internet, o mapa não aparece, e a tela continua com o resto.
- A política de uso do servidor de quadros do OpenStreetMap não aceita uso pesado. Gatilho para trocar: a publicação com usuários reais (fatia 10). A troca muda só a URL dos quadros em `mobile/src/map/`.

## Não verificado

- O mapa dentro do `WebView` no Expo Go e dentro do `iframe` da web pública. A verificação é feita nas tarefas do app e da web.
- O mapa em um aparelho real e no iOS.

## Verificação posterior

2026-11-11, nas tarefas do app e da web:

| Onde | Resultado |
|---|---|
| `WebView` no Expo Go, emulador Android | O mapa aparece com os quadros do OpenStreetMap, e um toque escolhe o ponto do desaparecimento |
| `iframe` da web pública, Chrome com a tela de um Pixel 7 | O mapa da ficha aparece (9 quadros), e um toque no mapa do formulário escolhe o ponto do avistamento |
| Peso das páginas públicas | No máximo 366 KB de JavaScript com gzip, dentro do orçamento de 500 KB |

Continua sem verificação: o mapa em um aparelho real e no iOS.


Referências: [Leaflet](https://leafletjs.com/reference.html), [política de uso dos quadros do OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/), [react-native-webview](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md), [Expo, WebView](https://docs.expo.dev/versions/latest/sdk/webview/).

## Mudança de 2026-11-15 (#306)

O mapa abre na posição da pessoa. A tela pega a posição com o `expo-location` ([ADR 0025](0025-localizacao-no-app.md)) e passa ao mapa, que mostra um ponto "Você está aqui". A página do mapa não pede mais a posição pelo `navigator.geolocation`: na web ela roda num `iframe` com `sandbox`, e o navegador bloqueia a localização ali. Os mapas de escolher um ponto (desaparecimento, avistamento, achado) pedem a posição só quando aparecem (`PickMap`). Sem a permissão, o mapa abre como antes: no primeiro aviso, ou no centro padrão.
