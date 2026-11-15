# ADR 0037: Câmera ao vivo no cadastro do focinho

Data: 2026-11-15. Estado: aceito. Este ADR aprova a dependência `expo-camera` (~58.0.14), aprovada pelo responsável pelo produto.

## Contexto

A etapa "Foto 1 de 2" do cadastro do focinho (Focinho-Captura) mostrava uma tela escura com um quadrado desenhado. O botão de disparo abria a câmera do sistema (`expo-image-picker`), e depois vinha um corte quadrado. O usuário passava por três telas para uma foto, e o quadrado da tela não era o quadrado da foto. Com o [ADR 0036](0036-vetor-do-recorte-do-focinho.md), a foto certa é o rosto de frente, e o serviço recorta o focinho.

## Decisão

1. No app (Android e iOS), a etapa de captura mostra a câmera ao vivo (`CameraView` do `expo-camera`), com o guia por cima. O disparo tira a foto na hora (`takePictureAsync`, qualidade 0,9, para ficar abaixo dos 8 MB de RN-59). Não existe mais o corte quadrado.
2. A permissão da câmera é pedida quando a etapa abre. Sem permissão, a tela diz isso e a galeria continua no canto de cima.
3. Na web estreita, a etapa continua com o seletor de foto do navegador, que no celular oferece a câmera. Os textos dizem o que acontece.
4. O fluxo "Achei um cachorro" usa a câmera do sistema sem o corte quadrado.
5. O `expo-camera` funciona no Expo Go, então o fluxo de teste no aparelho não muda.

## Alternativas

- Manter o `expo-image-picker` sem o corte. Tradeoff: nenhuma dependência nova, mas a tela continua a fingir uma câmera antes de abrir a câmera do sistema.
- `react-native-vision-camera`. Tradeoff: mais controle, mas não funciona no Expo Go e pede um build próprio.

## Consequências

- O `app.json` tem o plugin do `expo-camera`, com o texto da permissão para o build do app.
- Não verificado: a câmera ao vivo num aparelho real. O teste no Expo Go fica com o responsável pelo produto.
