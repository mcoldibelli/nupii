# ADR 0022: Web pública no alvo web do mesmo projeto Expo

Data: 2026-11-11. Estado: aceito para a foto e para o peso da página. O critério do mapa fica para a fatia 5. Este ADR aprova duas dependências no app: `react-native-web` e `@expo/metro-runtime`.

## Contexto

O [ADR 0006](0006-mobile-expo-web-publica.md) deixou a forma da web pública como hipótese: o alvo web do mesmo projeto Expo. Ele deu três critérios, medidos na tela "encontrei um pet" em um navegador de celular: foto, mapa e peso da página. O orçamento de JavaScript é definido antes da medida.

A fatia 4 entrega a página "encontrei um pet" (RF-12, RF-13, RNF-04). Ela não tem mapa: o visitante pode enviar a posição do aparelho, sem escolher um ponto. O mapa entra na fatia 5, com o avistamento.

## Orçamento

500 KB de JavaScript transferido, com compressão gzip, para abrir a página.

Motivo: quem encontra um cão na rua usa a rede móvel. Em uma rede 4G lenta (1,6 Mbit/s, 200 KB por segundo), 500 KB chegam em 2,5 segundos. O orçamento foi registrado na issue da tarefa antes da medida.

## Medida

Comando: `npx expo export -p web`, com o Expo SDK 58. Soma dos arquivos `.js` que o `index.html` carrega e do arquivo da rota, cada um com `gzip -9`.

| Arquivo | Tamanho | Com gzip |
|---|---|---|
| `entry` (React, React Native Web, Expo Router) | 1.090 KB | 286 KB |
| `__common` (código compartilhado, com o SDK do Firebase) | 351 KB | 73 KB |
| Runtime do Metro | 4 KB | 2 KB |
| Rota `found` | 8 KB | 3 KB |
| Total | 1.453 KB | 363 KB |

Nesta tabela, 1 KB tem 1.024 bytes. A primeira medida, com a rota ainda vazia, deu 360 KB. A tabela é a medida com a página pronta.

| Critério do ADR 0006 | Resultado |
|---|---|
| Foto | Passa. No Chrome, com a tela de um celular, a página abre o seletor de arquivo, e a API recebe o arquivo e devolve o candidato |
| Peso da página | Passa: 363 KB, dentro do orçamento de 500 KB |
| Mapa | Não medido. A página desta fatia não tem mapa |

## Decisão

1. A web pública sai do mesmo projeto Expo, pelo alvo web. O item 3 do ADR 0006 fica confirmado para a foto e para o peso da página.
2. O critério do mapa é medido na fatia 5, quando a biblioteca de mapa for escolhida. Se ele falhar, um ADR novo muda a forma da web pública.
3. A página pública é uma rota do Expo Router fora da proteção de sessão. Ela não espera a sessão e não pede conta.
4. A API responde com `Access-Control-Allow-Origin: *` nas rotas públicas, porque a página chama a API de outra origem. As rotas com token não têm esse cabeçalho.
5. O orçamento de 500 KB vale para toda página pública. Uma página nova é medida antes de entrar.

## Alternativas

- Projeto web separado (Vite e React). Tradeoff: uma página com cerca de 60 KB de JavaScript, com um segundo projeto, um segundo gerador de tipos e as regras do formulário escritas duas vezes.
- Carregar o SDK do Firebase só nas telas com conta. Tradeoff: cerca de 70 KB a menos na página pública, com uma mudança no layout raiz e na sessão. Fica como a primeira ação se o orçamento apertar.

## Consequência

- Um código para o app e para a web pública: as chamadas da API, as regras do contato e as mensagens são as mesmas.
- A página pública carrega o runtime do React Native Web e o SDK do Firebase, que ela não usa.
- O SDK do Firebase guarda a sessão de um jeito no app e de outro no navegador. `mobile/src/auth/firebase.ts` escolhe pelo alvo.
- A foto do focinho vai para a API sem nova compressão no seletor de imagem. Em uma foto pequena, a compressão tira o focinho do alcance do detector: uma foto de 255 pixels de lado caiu de 0,26 para 0,11 de confiança com qualidade 0,8.
- O app e a web leem o endereço da API da mesma variável (`EXPO_PUBLIC_API_URL`). O valor é diferente no emulador Android e no navegador.
- A publicação da web (onde os arquivos ficam, e o endereço) é decidida na fatia 10.

## Não verificado

- O critério do mapa.
- O tempo real de abertura em um celular com rede móvel. A medida deste ADR é o tamanho transferido.
- O seletor de arquivo em um navegador de celular real. A verificação foi feita em um navegador de computador.

Referências: [Expo, publicar para a web](https://docs.expo.dev/guides/publishing-websites/), [Expo Router, rotas protegidas](https://docs.expo.dev/router/advanced/protected/), [MDN, CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).
