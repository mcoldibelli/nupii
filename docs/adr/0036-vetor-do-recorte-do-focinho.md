# ADR 0036: Vetor do recorte do focinho

Data: 2026-11-15. Estado: aceito. Este ADR muda o pré-processamento do [ADR 0007](0007-inferencia-python-onnx.md): o detector continua o mesmo, e o vetor passa a sair do recorte do focinho, e não da foto inteira (#292).

## Contexto

Até aqui, o detector (RN-21) só decidia se a foto tinha um focinho, e o vetor saía da foto inteira reduzida a 224 px. O responsável pelo produto testou o cadastro com as fotos da cadela dele, uma Shih Tzu:

- As fotos de longe passavam, e o vetor era do rosto ou do corpo, não do focinho.
- As fotos só do focinho eram recusadas com `image_framing`.

As fotos do conjunto de calibração do modelo são o focinho recortado: a caixa do detector ocupa a foto inteira (razão 1,00 do percentil 10 ao 90, em 500 fotos de validação), e o lado mediano é de 128 px. Então o modelo espera o focinho preenchendo a imagem, e a foto do app manda o rosto.

## Medida

Com as 12 fotos da Shih Tzu, 500 fotos de validação e 150 cães do conjunto de treino, com 2 fotos cada um, num total de 44.700 pares de cães diferentes (medidas locais; as fotos não saem da máquina):

| Medida | Foto inteira (antes) | Recorte do focinho, caixa × 1,5 |
|---|---|---|
| Confiança do detector no recorte apertado do focinho | De 0,00 a 0,97, conforme o tamanho do recorte | Não se aplica: o detector roda na foto inteira |
| Pares do mesmo cão (Shih Tzu, recorte de pelo menos 160 px) | Vetores do rosto, não do focinho | Mediana 0,624; 96% acima de 0,351 |
| Pares de cães diferentes do treino acima de 0,351 | 3,50% (p99,9: 0,589) | 3,43% (p99,9: 0,587) |
| Shih Tzu contra 500 cães de validação, acima de 0,351 | Não comparável (rosto contra focinho) | 4,60% |
| Folga da caixa: 1,0, 1,2 e 1,5, pares da Shih Tzu | Não se aplica | Medianas 0,560, 0,580 e 0,624 |

A cauda dos cães diferentes em 0,351 não muda. Por isso, RN-13 e RN-15 continuam valendo.

## Decisão

1. O detector roda na foto inteira, uma vez. A caixa com a maior confiança dá o centro e o lado do focinho, em pixels da foto.
2. O recorte é um quadrado com o lado da caixa × 1,5, no máximo o lado menor da foto, movido para dentro da foto. Ele sai dos pixels originais, depois da rotação do EXIF (RN-58).
3. Um recorte com menos de 224 px (o lado que o embedder lê) é recusado com `image_framing`. A mensagem do app ("chegue mais perto") já serve para os dois casos de RN-21.
4. A nitidez (RN-20) continua medida na foto inteira, antes do enquadramento. A ordem dos erros do contrato não muda.
5. O vetor sai do recorte, com as mesmas funções de antes (`embedder_pixels`, `embed`).
6. O rótulo do vetor passa a ser `tinyvit21m-s43-crop`. O rótulo dos pesos continua `tinyvit21m-s43`: os arquivos e a release não mudam. Com o rótulo novo, o recálculo de RN-67 refaz os cadastros na subida da API, e a busca (RN-10) nunca mistura vetores dos dois pré-processamentos.
7. O teste de igualdade ([ADR 0019](0019-dados-do-teste-de-igualdade.md)) confere as funções que não mudaram: a decisão de nitidez, a confiança do detector e o vetor da foto inteira. O recorte tem testes próprios. A imagem gerada `17-texture-gray-large.png` (a 11 ampliada 5 vezes) é a imagem aceita do CI. A `11-texture-gray.png` passa a ser o caso "focinho pequeno demais".

## Alternativas

- Baixar o limite de RN-21. Tradeoff: nenhuma mudança no fluxo, mas a confiança do detector no recorte apertado varia de 0,00 a 0,97 no mesmo focinho, e nenhum limite separa o focinho do resto.
- Rodar o detector no recorte enviado pelo usuário. Tradeoff: o usuário controla o enquadramento, mas o detector erra justamente quando o focinho ocupa a imagem toda.
- Treinar outro detector. Fora do escopo ([ADR 0007](0007-inferencia-python-onnx.md)).

## Consequências

- O app e a web pedem uma foto do rosto, de frente e de perto, e não só do focinho.
- Um cadastro guardado que a versão nova recusa, por exemplo um recorte apertado feito na web ([ADR 0034](0034-focinho-na-web.md)), fica fora da busca (RN-67). O tutor precisa cadastrar o focinho de novo. A API registra no log quantos cadastros foram refeitos e quantos ficaram de fora.
- A medida usou uma raça só (Shih Tzu) para as fotos do app. Outras raças não foram medidas.
