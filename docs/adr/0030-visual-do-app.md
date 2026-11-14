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

## Verificação posterior

Data: 2026-11-12. A fatia 9b trocou cores, fontes e componentes, mas não refez o layout das telas. O responsável pelo produto recusou o resultado: as telas seguem os layouts do canvas, e não só o tema. A decisão continua, com estes ajustes:

1. A fatia 9c refaz cada tela a partir do artboard dela e constrói os comportamentos do canvas que a API já permite, com o backend que faltar. Uma tela só fica pronta depois da comparação lado a lado com o artboard.
2. A apresentação de boas-vindas (RF-33) aparece só na primeira abertura do app.
3. O app vai para a primeira tela de cada estado da sessão quando o estado muda (`app/_layout.tsx`): a apresentação ou entrar sem sessão, completar o cadastro, ou o início. Antes, o roteador escolhia uma tela qualquer entre as permitidas, e isso causou três bugs.
4. No app, o mural, a ocorrência, o achei um cachorro e os termos abrem sem conta (RNF-04).
5. O cadastro do pet e do focinho (AddPet-Primeiro, AddPet-Novo, Focinho-Intro, Focinho-Captura, Focinho-Revisao) tem duas diferenças do canvas. O app cadastra só cachorro (RN-48), como o canvas; a raça vem de uma lista com busca. A captura não mostra a câmera ao vivo: o botão abre a câmera do aparelho com recorte quadrado, e o botão do flash virou o botão da galeria. A câmera ao vivo pede a dependência `expo-camera`, que não foi aprovada.
6. O perfil do pet (Pet) mostra só o cadastro principal do focinho, porque a API devolve só esse (RN-60). O canvas mostra cinco capturas. O menu "Mais opções" leva a editar os dados e à carteirinha. A tela de editar ganhou um artboard próprio no canvas, "Editar pet · mobile" (EditPet-Mobile), no padrão do AddPet-Novo e com todos os dados do pet (#205).
7. A saúde (Saude-Mobile, Saude-Mobile-Registrar, Saude-Mobile-Form) tem uma quinta aba, Anotações, porque as anotações (peso, sintoma) não têm outro lugar na lista. "Já dei" cria uma dose nova com os dados da dose atrasada e a data de hoje, e o próximo cuidado passa a contar dela (RN-81). Cada opção do "Anotar" abre um formulário só daquela categoria (vacina, antipulgas, vermífugo, medicação, consulta, exame, sintoma, peso, anotação), sem a escolha do tipo (#213). O início tem o mesmo "Anotar" como acesso rápido, num botão flutuante laranja com "+", no canto inferior direito, acima da barra de navegação (#227). A opção "Fotografar a carteirinha" não foi feita: ler as vacinas de uma foto pede um serviço de OCR externo, que não foi aprovado.
8. A carteirinha (Carteirinha-Mobile) não tem número e não tem PDF: a API não tem número de carteirinha, e gerar PDF pede uma dependência nova. O QR code aparece na carteirinha depois que o tutor cria um link. "Copiar" virou "Mais" (o compartilhar do sistema), porque o app não tem acesso à área de transferência sem uma dependência nova. A opção "Incluir exames e laudos" mostra os exames sem os anexos (RN-83).
9. O mapa do mural (Mural-Mobile-Mapa) é o mapa do ADR 0023 (Leaflet e OpenStreetMap), com um marcador por ocorrência; o toque no marcador mostra o nome. Os marcadores não têm a foto do pet, como no canvas. Sem a localização do aparelho, o mural mostra tudo. O mural não mostra o nome da cidade, porque isso pede um serviço de geocodificação.
10. As notificações (Notificacoes-Modal) abrem num painel sob o sino, com "marcar todas como lidas" (RN-74). O botão de configurar notificações não foi feito: a API não tem preferências de notificação. A conta não tem artboard no canvas: a tela usa os componentes do canvas (cartão escuro, campos, botões e linhas de navegação).
11. O resultado do scan (Match) mostra os candidatos com a foto de perfil, a semelhança e "Alta confiança", e depois o contato. Ele não mostra as duas fotos de focinho lado a lado, como o canvas: a foto do focinho não aparece depois da busca (RN-86, #214).
12. A ficha da ocorrência não tinha artboard. Ela ganhou o artboard "Ocorrência · mobile" (Ocorrencia-Mobile) no canvas: foto ampla (perfil do pet ou foto do achado, RN-86), tipo e tempo, dados, o cartão "Escaneie o focinho" para um pet com focinho cadastrado, o mapa, a linha dos avistamentos e "Vi este cachorro", que abre o avistamento numa folha (#221).
13. Os campos de data abrem um calendário próprio numa folha, com o mês, a escolha rápida do ano e os limites das regras (RN-50, RN-71, RN-76), no app e na web. Ele não usa o seletor nativo (`@react-native-community/datetimepicker`): o seletor não funciona na web pública e seria uma dependência nova (#229).
14. A web usa os artboards de 1440 px a partir de 960 px de largura (`useWide`, #231). O `WebFrame` põe a barra lateral (Inicio-Web, Mural-Web) para quem tem conta e o cabeçalho do topo (Landing-Web, Achei-Web) para o visitante; a barra de baixo some. O mural põe os cartões em duas colunas ao lado do mapa; o achei tem a coluna "Pode ser um destes?"; a carteirinha pública tem as colunas da Carteirinha-Web; a ficha tem a foto à esquerda e os dados à direita. A web tem a página de entrada `/landing` (Landing-Web): o visitante que abre `/` vai para ela, no lugar de entrar. Os perdidos da página vêm do mural de verdade. A busca por endereço do Mural-Web não foi feita, porque pede um serviço de geocodificação. Na web, o raio do mural é uma linha de opções, porque o React Native Web não mostra um Alert com botões.
15. A linha "sumiu? Avisar desaparecimento" do Inicio-Mobile saiu do meio do início, por decisão do responsável pelo produto: um desaparecimento é eventual, e a linha ficava entre Carteirinha e Ver agenda. Ela fica no fim do início, sem borda e em cinza, e o perfil do pet continua com o botão. A tela do desaparecimento não tinha artboard: ela usa o layout dos formulários de saúde (fechar, chip do pet, título, campos preenchidos, mapa com cantos e o botão no rodapé) (#243).
16. Na web larga, entrar, criar conta e recuperar a senha usam a página dividida do Login-Web e do Cadastro-Web (`AuthSplit`, #232): o formulário à esquerda, com o logo e "Voltar para o início", e o lado roxo (entrar, recuperar) ou laranja (criar conta) com o cachorro à direita. O botão "Continuar com Google" entra com o login com Google ([issue #153](https://github.com/mcoldibelli/nupii/issues/153)). O passo "1 de 2" e a etapa de alertas (Cadastro-Web-Alertas) entram com a [issue #169](https://github.com/mcoldibelli/nupii/issues/169). As rotas com token aceitam a origem da web pela variável `WEB_ORIGINS` ([ADR 0029](0029-publicacao-na-vps.md), item 8).
17. A entrada do desaparecimento no início mudou de novo, por decisão do responsável pelo produto (proposta 2 do canvas de propostas): a linha do fim do início saiu, e a folha do botão + do início tem a seção "Emergência" com "<pet> sumiu". A folha abre com frequência, então o toque pede confirmação dentro da própria folha ("Sim, avisar desaparecimento" ou "Cancelar"), sem `Alert.alert`, que não funciona na web. Só o "Sim" abre o formulário. O perfil do pet continua com o botão (#257).
