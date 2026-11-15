# ADR 0019: Dados do teste de igualdade da inferência

Data: 2026-11-11. Estado: aceito. Com o [ADR 0036](0036-vetor-do-recorte-do-focinho.md), o teste confere as decisões e o vetor da foto inteira pelas funções que não mudaram; o recorte do focinho tem testes próprios, e a imagem `17-texture-gray-large.png` fica fora dos valores de referência.

## Contexto

O [ADR 0007](0007-inferencia-python-onnx.md) pede um teste de igualdade no repositório: o vetor do serviço contra o vetor de referência, com fotos reais de focinho, e as mesmas decisões de nitidez (RN-20) e de enquadramento (RN-21).

As fotos reais de focinho disponíveis são do conjunto de validação do modelo. Os termos de uso desse conjunto não permitem entregar as fotos a terceiros. Então as fotos não podem ficar no repositório nem em uma release.

O CI precisa de um teste de igualdade: o ADR 0007 deixou sem verificar o resultado no Linux x86, que é onde o serviço é executado.

## Medida

Valores de referência gerados com o pré-processamento de referência do modelo, e as decisões que eles dão com os limites de RN-20 (0,20) e de RN-21 (0,25):

| Conjunto | Imagens | Recusadas por nitidez | Sem focinho | Aceitas |
|---|---|---|---|---|
| Imagens geradas | 16 | 4 | 14 | 1 |
| Fotos reais de focinho | 60 | 10 | 7 | 43 |

Uma imagem pode ser recusada pelos dois motivos. O resultado do serviço contra esses valores está no [ADR 0018](0018-python-e-dependencias-da-inferencia.md).

## Decisão

1. O teste de igualdade tem dois conjuntos de imagens.
2. Conjunto de imagens geradas: 16 arquivos em `inference/tests/data/synthetic/`, versionados. Eles têm ruído, textura, gradiente, cor única, tons de cinza, transparência, paleta, rotação no EXIF e os formatos PNG, JPEG e WebP. O teste deste conjunto é executado em toda execução dos testes, no ambiente local e no CI.
3. Conjunto de fotos reais: 60 fotos do conjunto de validação do modelo, tiradas em intervalos iguais da lista em ordem de nome. O repositório tem só o nome, o SHA-256 e os valores de referência de cada foto. As fotos ficam fora do repositório.
4. O teste das fotos reais é executado com `pytest -m real_photos` e a variável `NOSE_PHOTOS_DIR`. Sem a variável, ele falha. Ele é executado no ambiente local em toda mudança do pré-processamento ou das versões do [ADR 0018](0018-python-e-dependencias-da-inferencia.md), e o resultado vai para o PR.
5. Critério dos dois conjuntos: cosseno de pelo menos 0,9999, a mesma decisão de nitidez e a mesma decisão de enquadramento. O SHA-256 de cada arquivo é conferido antes do uso.
6. Os valores de referência ficam em `inference/tests/data/synthetic.npz` e `real_photos.npz`. Eles são gerados fora do repositório, uma vez por versão do modelo.

## Alternativas

- Guardar as fotos reais em uma release privada do repositório. Tradeoff: o CI executa também o conjunto real, mas os termos de uso das fotos não permitem essa entrega.
- Só as imagens geradas. Tradeoff: nenhum dado fora do repositório, mas só uma imagem gerada é aceita pelo detector, e nenhuma é um focinho.
- Só as fotos reais, no ambiente local. Tradeoff: nenhum arquivo de teste no repositório, mas o CI fica sem teste de igualdade e o Linux x86 nunca é conferido.

## Consequência

- O CI confere a igualdade numérica no Linux x86 com as imagens geradas. As decisões com focinhos reais são conferidas só por quem tem as fotos.
- O repositório ganha cerca de 1,5 MB de arquivos de teste.
- Uma versão nova do modelo troca os dois arquivos de valores de referência.
- Se aparecer um conjunto de fotos de focinho com licença que permite a distribuição, ele entra no repositório e o CI passa a conferir as decisões com focinhos reais.

## Não verificado

- O resultado no Linux x86, até o workflow `inference` existir.

Referência: [NumPy, formato `.npz`](https://numpy.org/doc/stable/reference/generated/numpy.savez_compressed.html).
