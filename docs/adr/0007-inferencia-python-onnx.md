# ADR 0007: Inferência em serviço Python separado, sem torch

Data: 2026-11-10. Estado: aceito. O [ADR 0036](0036-vetor-do-recorte-do-focinho.md) muda a entrada do vetor: o recorte do focinho, e não a foto inteira.

## Contexto

O serviço de inferência transforma a foto do focinho em um vetor de 512 dimensões (RN-18). O modelo é pré-treinado e chega como um artefato externo ao repositório, em ONNX (RN-19). O treino, a exportação e a validação do modelo estão fora do escopo deste repositório.

Os limiares da identificação (RN-13 e RN-15) foram calibrados com o pré-processamento de referência do modelo, que usa torch e torchvision. O serviço precisa produzir os mesmos vetores. Se o vetor mudar, os limiares deixam de valer.

A rede roda em ONNX Runtime. Em volta dela, o pré-processamento de referência usa o torch para sete operações de aritmética: converter a imagem em tensor, normalizar, medir a nitidez com um laplaciano, espelhar, somar os dois vetores, normalizar o vetor e limitar o número de threads. O redimensionamento é feito pelo Pillow: para uma imagem PIL, o torchvision chama `img.resize` (`torchvision/transforms/_functional_pil.py:250`).

O torch ocupa 316 MB no ambiente local (macOS arm64). O onnxruntime ocupa 75 MB.

## Medida

As mesmas operações foram escritas com Pillow e NumPy e comparadas com o pré-processamento de referência, com o modelo `tinyvit21m_s43.onnx`, em 30 imagens (10 fotos de cães e 20 figuras).

| Comparação | Resultado |
|---|---|
| Tensor de entrada da rede | Igual bit a bit nas 30 imagens |
| Cosseno entre o vetor com torch e o vetor sem torch | 1,0 nas 30 imagens, dentro da precisão do float32 |
| Variância do laplaciano (nitidez) | Maior diferença relativa: 1,1e-7 |

Tamanho do código na medida: 8 linhas com torch, 11 linhas sem torch. Um detalhe precisa de atenção na versão sem torch: a variância do torch divide por N-1, então o NumPy precisa de `ddof=1`. O teste do item 4 cobre esse detalhe.

## Decisão

1. A inferência fica em um serviço Python separado, sem estado, com este contrato: `POST /v1/nose/embedding`, `GET /v1/model-info`, `GET /health`.
2. O serviço usa FastAPI, ONNX Runtime, Pillow e NumPy. Sem torch.
3. Os pesos têm o rótulo de versão `tinyvit21m-s43`. O SHA-256 dos arquivos é conferido na carga.
4. A comparação acima vira um teste do repositório. Os vetores de referência, gerados com o pré-processamento de referência, ficam junto do teste. Critério: cosseno de pelo menos 0,9999 em todas as fotos, e as mesmas decisões de aceite e recusa por nitidez e enquadramento.

## Alternativas

- Usar o torch só para CPU. Tradeoff: o pré-processamento fica idêntico ao de referência sem teste de igualdade, com 316 MB a mais e uma dependência que só faz aritmética.
- Rodar o ONNX dentro do binário Go. Tradeoff: um serviço a menos, com cgo no build e a decodificação de imagem (inclusive a rotação do EXIF) escrita em Go.
- Treinar um modelo novo. Fora do escopo.

## Consequência

- A imagem do serviço fica cerca de 300 MB menor do que com torch.
- Este repositório não treina, não exporta e não mede o modelo. Uma versão nova do modelo chega com pesos novos, vetores de referência novos e limiares novos.
- Os vetores de referência são gerados fora do repositório, uma vez por versão do modelo.

## Não verificado

- A medida usou 10 fotos de cães e 20 figuras, não o conjunto de validação do modelo. O teste do item 4 precisa de fotos reais de focinho.
- A medida foi feita no macOS arm64. O Linux x86 do container não foi testado.
- A decisão de enquadramento (detector) não entrou na medida.
- O tempo de subida e a memória do serviço com e sem torch.

Referência: [ONNX Runtime, API Python](https://onnxruntime.ai/docs/api/python/api_summary.html).
