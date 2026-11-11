# ADR 0006: App em React Native com Expo, web pública mínima

Data: 2026-11-10. Estado: aceito para o app e para a existência da web pública. A forma da web (item 3) fica adiada para a fatia 4, com os critérios abaixo.

## Contexto

O tutor usa câmera, mapa, push e localização (RF-11, RF-18, RF-22, RF-26). O cliente do tutor precisa ser um app mobile, para Android e iOS (RNF-05).

Os requisitos têm fluxos que funcionam sem conta: mural, ficha, "encontrei um pet", avistamento e a carteirinha por link (RF-12, RF-16, RF-17, RF-19, RF-20, RF-31). Quem encontra um cão na rua não tem o app instalado (RNF-04).

## Decisão

1. O tutor usa um app feito com React Native e Expo, em TypeScript, para Android e iOS. (aceito)
2. O visitante usa uma web pública mínima com cinco fluxos: mural, ficha, "encontrei um pet", avistamento e carteirinha. (aceito)
3. A web pública sai do mesmo projeto Expo, pelo alvo web. (hipótese de partida, decisão na fatia 4)

Critérios para confirmar o item 3 na fatia 4, medidos na tela "encontrei um pet" em um navegador de celular:

| Critério | Passa quando |
|---|---|
| Foto | O visitante tira ou escolhe uma foto e a API recebe o arquivo. |
| Mapa | O mapa aparece e aceita a escolha de um ponto. |
| Peso da página | O JavaScript transferido não passa do orçamento, em KB. O orçamento é definido na fatia 4, antes da medida. |

Se um critério falhar, a web pública vira um projeto web separado e um ADR novo registra a troca.

## Alternativas

Para o app:

- Flutter. Tradeoff: bom suporte a câmera e ML, com uma segunda linguagem no sistema (Dart) e outro gerador de tipos para o contrato ([ADR 0005](0005-contrato-openapi.md)).
- .NET MAUI. Tradeoff: um código para Android e iOS, sem alvo web.
- Kotlin nativo. Tradeoff: a melhor integração com câmera e ML, só para Android.

Para a forma da web pública:

- Projeto web separado (Vite e React). Tradeoff: páginas mais leves e sem os limites do alvo web do Expo, com um segundo projeto e telas duplicadas (mural e ficha existem nos dois).

## Consequência

- Um código para Android, iOS e web.
- Módulos nativos (runtime ONNX, câmera com processamento de quadros) pedem um build de desenvolvimento. O Expo Go não serve para eles.
- A web gerada pelo Expo carrega o runtime do React Native Web. A página do visitante fica mais pesada que uma página feita só para web.

## Não verificado

- Se a câmera e o mapa do Expo funcionam no alvo web com a qualidade necessária para "encontrei um pet". Verificar na fatia 4. Se não funcionarem, o item 3 muda para um projeto web separado.
- Se o runtime ONNX roda o detector no aparelho com velocidade para guiar a câmera. É a prova técnica descrita no [roteiro](../roteiro.md).

Referências: [Expo](https://docs.expo.dev/), [Expo, development builds](https://docs.expo.dev/develop/development-builds/introduction/), [ONNX Runtime para React Native](https://onnxruntime.ai/docs/get-started/with-javascript/react-native.html).
