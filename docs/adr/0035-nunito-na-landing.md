# ADR 0035: Fonte Nunito na landing

Data: 2026-11-15. Estado: aceito. Este ADR aprova a dependência `@expo-google-fonts/nunito`.

## Contexto

A landing da web (`/landing`, Landing-Web) usava as fontes do app: Bricolage Grotesque nos títulos e Figtree no texto ([ADR 0030](0030-visual-do-app.md), item 2). O responsável pelo produto pediu a Nunito na landing, nos títulos e no texto (#290).

## Decisão

1. A landing usa a Nunito: 800 nos títulos, 700 no texto em destaque e nos botões, 400 no texto corrido (`landingFonts` em `mobile/src/ui/theme.ts`).
2. A fonte vem do pacote `@expo-google-fonts/nunito`, como as outras fontes do app. Os arquivos `.ttf` ficam no pacote da web, e o navegador não chama o Google. A licença é OFL.
3. O app carrega só os três pesos usados.
4. O `Button` ganha a prop `labelFont`, e só a landing a usa.
5. O cabeçalho do visitante (Mural, Achei, Entrar) e as outras páginas continuam com Bricolage Grotesque e Figtree.

## Alternativas

- Nunito pela folha de estilo do Google Fonts. Tradeoff: nenhum pacote novo, mas a CSP precisa liberar o Google, e o Google recebe o IP de quem abre a landing.
- A Nunito em todo o app. Tradeoff: um visual só, mas o pedido foi só para a landing, e o canvas usa Bricolage Grotesque e Figtree.

## Consequências

- Três arquivos de fonte a mais no pacote da web, que o app carrega na primeira tela, como as outras fontes.
- A landing tem um visual diferente do resto do app.
