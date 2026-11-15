# ADR 0034: Foto do focinho na web, com recorte, webcam e HEIC

Data: 2026-11-15. Estado: aceito. Este ADR aprovava uma dependência no app, `heic2any` 0.0.4, só na web; ela saiu no #270 (item 6). Com o [ADR 0036](0036-vetor-do-recorte-do-focinho.md), o quadrado é do rosto, e não só do focinho: o serviço acha e recorta o focinho. O recorte mínimo passou de 224 px para 960 px: nos recortes do rosto medidos no #292, o recorte do focinho ficou entre 24% e 37% do lado, e 224 / 0,24 dá cerca de 930 px. O quadrado começa com 90% da área. Com o caminho da web, as 10 fotos de rosto do #292 passam, e as 2 de longe são recusadas.

## Contexto

O artboard Focinho-Web pede, no navegador do computador, uma foto antiga ou da webcam, recortada num quadrado só com o focinho, e aceita HEIC. O responsável pelo produto aprovou as quatro partes em 2026-11-14 (#233, #272).

A foto do focinho não pode ter uma nova compressão: o detector pode deixar de achar o focinho (`mobile/src/pets/pickPhoto.ts`). A API aceita JPEG, PNG e WebP de até 8 MB (RN-59). O detector lê a foto em 640 px (`_DETECTOR_SIDE`) e o modelo de vetor em 224 px (`_EMBEDDER_SIDE`, `inference/app/nose.py`). Só o Safari abre HEIC; o Chrome e o Firefox não.

## Decisão

1. A página só existe na web com a tela larga (`Platform.OS === "web"` e 960 px ou mais). O app, também num tablet, continua com a câmera.
2. O zoom e o quadrado mudam só a imagem na tela. O arquivo é o quadrado em pixels da foto, em PNG (sem perda), pixel a pixel até 1280 px de lado. Um recorte maior sai com 1280 px: o detector lê 640 px, então nada que o modelo usa se perde, e um PNG de 1280 × 1280 tem no máximo cerca de 4,9 MB, abaixo dos 8 MB de RN-59.
3. Um recorte menor que 224 px (a entrada do modelo) não é aceito: o botão fica desligado e a marca explica.
4. "Resolução ok" é conferido no navegador. "Só o focinho" e "Nítida" vêm da conferência da API (RN-85), depois do recorte.
5. A webcam pede 1920 × 1080; o quadro vai em PNG para o recorte. A câmera para no "Cancelar", depois da foto e quando a página sai.
6. ~~Uma foto HEIC é convertida no navegador com a `heic2any`.~~ Removido no #270: a `heic2any` usa `new Function`, e a CSP valendo, sem `'unsafe-eval'`, impede a conversão. A dependência saiu. O navegador abre a foto sozinho: o Safari abre HEIC, e nos outros navegadores a página pede uma foto em JPG ou PNG.

## Alternativas

- Enviar a foto inteira, sem recorte. Tradeoff: nenhum código de recorte, mas a foto antiga de um cachorro inteiro não passa no detector (`image_framing`).
- Recortar em JPEG. Tradeoff: arquivo menor, mas uma nova compressão da foto do focinho.
- HEIC só no Safari. Tradeoff: nenhuma dependência, mas a foto do iPhone não entra pelo Chrome.

## Consequências

- O pedaço da `heic2any` tem 341 KB comprimidos e só carrega para uma foto HEIC. O pacote principal não mudou (294 KB comprimidos antes e depois); a tela do focinho passou de 5,6 KB para 8,3 KB.
- Verificação (API local, foto real do conjunto de teste, que não sai da máquina por causa da licença): o recorte de 392 px foi gravado como PNG de 392 × 392; as duas fotos passaram na conferência e foram cadastradas; um recorte central da mesma foto feito por outra ferramenta (400 px, JPEG) achou o pet com 98,7% de semelhança.
