# ADR 0030: Visual do app a partir do canvas de design

Data: 2026-11-11. Estado: aceito. Este ADR aprova quatro dependências no app: `expo-font`, `@expo-google-fonts/bricolage-grotesque`, `@expo-google-fonts/figtree` e `react-native-svg`.

## Contexto

O app usa um arquivo de estilos com 18 linhas (`mobile/src/screens/styles.ts`) e os ícones padrão do Expo. Nenhuma fatia do roteiro tinha o visual no escopo. A publicação (fatia 10) leva o app a usuários reais.

O responsável pelo produto tem um canvas de design com 46 telas, mobile e web ("Nupii App Screens"). Ele escolheu esse canvas como a referência do visual.

O canvas usa duas fontes do Google Fonts e ícones de traço em SVG. O React Native não tem SVG no núcleo.

## Decisão

1. O canvas é a referência do visual. O tema (cores, fontes, espaços, cantos) e os componentes saem dele. Um par de cor que falha no contraste AA da WCAG muda, e a mudança fica registrada no arquivo do tema.
2. As fontes são Bricolage Grotesque (títulos) e Figtree (texto), com licença OFL. O app carrega as duas com `expo-font` e os pacotes `@expo-google-fonts`.
3. Os ícones são os traços do canvas, desenhados com `react-native-svg`. Só `mobile/src/ui/Icon.tsx` importa o pacote.
4. A fatia 9b muda só o visual das telas e funções que existem, e põe a barra de navegação embaixo. As funções do canvas que o sistema não tem viram issues com o rótulo `backlog`.
5. O QR code da carteirinha ([ADR 0027](0027-link-da-carteirinha.md)) continua com componentes `View`.

## Alternativas

- Fontes do sistema. Tradeoff: nenhuma dependência, mas o app fica longe do canvas.
- `@expo/vector-icons` no lugar de `react-native-svg`. Tradeoff: muitos ícones prontos, mas parecidos com os do canvas, e não iguais.

## Consequências

- O app espera as fontes carregarem antes de mostrar a primeira tela.
- Um teste confere o contraste dos pares de cor do tema.
