# Inference

Serviço de inferência do Nupii: transforma a foto de um focinho em um vetor de 512 dimensões. Python, FastAPI e ONNX Runtime, sem torch. As decisões estão no [ADR 0007](../docs/adr/0007-inferencia-python-onnx.md), no [ADR 0018](../docs/adr/0018-python-e-dependencias-da-inferencia.md) e no [ADR 0019](../docs/adr/0019-dados-do-teste-de-igualdade.md). O contrato está em [docs/arquitetura.md](../docs/arquitetura.md), na seção "Serviço de inferência".

Todos os comandos abaixo são executados no diretório `inference`.

## Como executar

Requisitos: Python 3.14 e o GitHub CLI (`gh`) com acesso ao repositório.

1. Crie o ambiente virtual e instale as dependências:

   ```bash
   python3.14 -m venv .venv
   . .venv/bin/activate
   pip install -r requirements-dev.txt
   ```

2. Baixe os arquivos de pesos. O script baixa os dois arquivos da release `model-tinyvit21m-s43` para o diretório `models` e confere o SHA-256 (RN-22):

   ```bash
   ./download_weights.sh
   ```

3. Suba o serviço:

   ```bash
   uvicorn app.main:app --port 8000
   ```

4. Envie uma foto:

   ```bash
   curl --data-binary @foto.jpg http://localhost:8000/v1/nose/embedding
   ```

O serviço não sobe sem os arquivos de pesos ou com um arquivo que tem outro SHA-256.

## Como testar

```bash
pytest
```

Os testes usam os arquivos de pesos reais. Sem os arquivos em `models`, eles falham.

O teste de igualdade tem dois conjuntos de imagens ([ADR 0019](../docs/adr/0019-dados-do-teste-de-igualdade.md)):

- As 16 imagens geradas de `tests/data/synthetic` entram em toda execução do `pytest`.
- As 60 fotos reais de focinho não ficam no repositório. Quem tem as fotos executa o teste com o diretório delas:

  ```bash
  NOSE_PHOTOS_DIR=/caminho/das/fotos pytest -m real_photos
  ```

  Execute esse teste em toda mudança de `app/nose.py` ou das versões do `requirements.txt`, e ponha o resultado no PR.

## Lint

```bash
./lint.sh
```

O lint é o `ruff`: conferências estáticas e formato. Para corrigir o formato: `ruff format .`.

## Variáveis de ambiente

| Variável | Padrão | Para que serve |
|---|---|---|
| `MODELS_DIR` | `models` | Diretório com os dois arquivos de pesos |
| `INFERENCE_THREADS` | `2` | Número de threads de cada rede |
| `NOSE_PHOTOS_DIR` | sem padrão | Só nos testes: diretório das fotos reais do teste de igualdade |

## Estrutura

| Caminho | O que tem |
|---|---|
| `app/main.py` | A interface HTTP: caminhos, erros, uma inferência por vez (RN-23) e o log de cada requisição |
| `app/nose.py` | Da foto ao vetor: abertura da imagem, nitidez (RN-20), detector (RN-21) e vetor (RN-18, RN-19) |
| `app/weights.py` | Nomes, versão e SHA-256 dos arquivos de pesos (RN-22) |
| `download_weights.sh` | Baixa os arquivos de pesos e confere o SHA-256 |
| `tests/data/` | Imagens geradas e valores de referência do teste de igualdade |

Uma versão nova do modelo muda `app/weights.py`, a tag da release em `download_weights.sh` e os dois arquivos de valores de referência.
