# ADR 0035: Fonte Nunito no app

Data: 2026-11-15. Estado: aceito. Este ADR aprova a dependência `@expo-google-fonts/nunito`. Primeiro a Nunito entrou só na landing (#290); depois, a pedido do responsável pelo produto, ela passou a valer em todo o app (#300), e as dependências da Bricolage Grotesque e da Figtree saíram.

## Contexto

A landing da web (`/landing`, Landing-Web) usava as fontes do app: Bricolage Grotesque nos títulos e Figtree no texto ([ADR 0030](0030-visual-do-app.md), item 2). O responsável pelo produto pediu a Nunito na landing, nos títulos e no texto (#290).

## Decisão

1. Todo o app usa a Nunito (`fonts` em `mobile/src/ui/theme.ts`): 800 nos títulos, 700 nos subtítulos, nos botões e no texto em destaque, 600 e 500 nos rótulos, 400 no texto corrido.
2. A fonte vem do pacote `@expo-google-fonts/nunito`, como as outras fontes do app. Os arquivos `.ttf` ficam no pacote da web, e o navegador não chama o Google. A licença é OFL.
3. O app carrega só os cinco pesos usados (400, 500, 600, 700 e 800).
4. Os pacotes `@expo-google-fonts/bricolage-grotesque` e `@expo-google-fonts/figtree` saíram do projeto.
5. O canvas de design continua com Bricolage Grotesque e Figtree. O app segue o layout do canvas, com a Nunito no lugar das duas.

## Alternativas

- Nunito pela folha de estilo do Google Fonts. Tradeoff: nenhum pacote novo, mas a CSP precisa liberar o Google, e o Google recebe o IP de quem abre a landing.
- A Nunito só na landing (a primeira versão deste ADR). Tradeoff: o canvas igual no resto do app, mas dois visuais diferentes no mesmo produto.

## Consequências

- Cinco arquivos de fonte no pacote da web, no lugar dos seis da Bricolage Grotesque e da Figtree.
- O app e o canvas têm fontes diferentes; a comparação com o canvas olha o layout, não a fonte.
