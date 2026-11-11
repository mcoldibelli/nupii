# ADR 0018: Python, dependências e ferramentas do serviço de inferência

Data: 2026-11-11. Estado: aceito. Este ADR aprova as dependências do serviço de inferência: `fastapi`, `uvicorn`, `onnxruntime`, `pillow` e `numpy`, e as ferramentas de teste `pytest`, `httpx` e `ruff`.

## Contexto

O [ADR 0007](0007-inferencia-python-onnx.md) decidiu que a inferência é um serviço Python com FastAPI, ONNX Runtime, Pillow e NumPy, sem torch. Ele não fixou a versão do Python, as versões das bibliotecas, o servidor HTTP nem as ferramentas de teste.

O vetor do serviço precisa ser igual ao vetor de referência do modelo (critério do ADR 0007). O redimensionamento da imagem é feito pelo Pillow, então a versão do Pillow faz parte do resultado.

O serviço recebe uma imagem e devolve JSON. Quem chama o serviço é a API, não o app.

## Medida

O pré-processamento foi escrito com Pillow e NumPy no Python 3.14 e comparado com os valores de referência, no macOS arm64. Os dois conjuntos de imagens estão descritos no [ADR 0019](0019-dados-do-teste-de-igualdade.md).

| Conjunto | Menor cosseno | Maior diferença relativa da nitidez | Maior diferença da confiança do detector | Decisões diferentes |
|---|---|---|---|---|
| 16 imagens geradas | 0,99999803 | 4,7e-7 | 0 | 0 |
| 60 fotos reais de focinho | 0,99999988 | 1,3e-7 | 0 | 0 |

Versões na medida: Pillow 13.0.0, NumPy 2.5.4, ONNX Runtime 1.31.1. Os valores de referência foram gerados com Pillow 11.1.0.

## Decisão

1. O serviço usa o Python 3.14.
2. Dependências do serviço, com versão exata em `inference/requirements.txt`: `fastapi` 0.162.4, `uvicorn` 0.54.0, `onnxruntime` 1.31.1, `pillow` 13.0.0, `numpy` 2.5.4.
3. Ferramentas de teste e de lint, em `inference/requirements-dev.txt`: `pytest` 9.2.0, `httpx` 0.28.1 (o cliente de teste do FastAPI precisa dele) e `ruff` 0.17.4.
4. O corpo de `POST /v1/nose/embedding` é o conteúdo da imagem, sem `multipart/form-data`.
5. A configuração vem de variáveis de ambiente, lidas com a biblioteca padrão.
6. Uma mudança de versão do Pillow, do NumPy ou do ONNX Runtime só entra com os dois conjuntos do teste de igualdade executados.

## Alternativas

- Corpo `multipart/form-data`. Tradeoff: é a forma que um navegador envia um arquivo, mas pede a dependência `python-multipart`, e quem chama o serviço é a API, que envia os bytes direto.
- `pydantic-settings` para a configuração. Tradeoff: validação de tipos pronta, com uma dependência a mais para duas variáveis.
- Arquivo de trava com todas as dependências transitivas. Tradeoff: instalação igual em toda máquina, com uma ferramenta a mais para gerar o arquivo. As três bibliotecas que mudam o vetor já têm versão exata.

## Consequência

- A instalação usa só o `pip`: `pip install -r requirements.txt`.
- As dependências transitivas do `fastapi` não têm versão exata. Uma falha de instalação no futuro pede um arquivo de trava.
- O lint do serviço é `ruff check` e `ruff format --check`.

## Não verificado

- A igualdade no Linux x86. O workflow `inference` faz essa verificação com o conjunto de imagens geradas.
- O tempo de subida e a memória do serviço.

Referências: [FastAPI](https://fastapi.tiangolo.com/), [ONNX Runtime, API Python](https://onnxruntime.ai/docs/api/python/api_summary.html), [Pillow, `Image.resize`](https://pillow.readthedocs.io/en/stable/reference/Image.html#PIL.Image.Image.resize).
