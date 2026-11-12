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
5. O cadastro do pet e do focinho (AddPet-Primeiro, AddPet-Novo, Focinho-Intro, Focinho-Captura, Focinho-Revisao) tem duas diferenças do canvas. O formulário tem a escolha da espécie, porque o app também cadastra gato e outro (RN-48). A captura não mostra a câmera ao vivo: o botão abre a câmera do aparelho com recorte quadrado, e o botão do flash virou o botão da galeria. A câmera ao vivo pede a dependência `expo-camera`, que não foi aprovada.
6. O perfil do pet (Pet) mostra só o cadastro principal do focinho, porque a API devolve só esse (RN-60). O canvas mostra cinco capturas. O menu "Mais opções" leva a editar os dados e à carteirinha. A tela de editar não tem artboard no canvas e fica com o formulário de antes.
7. A saúde (Saude-Mobile, Saude-Mobile-Registrar, Saude-Mobile-Form) tem uma quinta aba, Anotações, porque as anotações (peso, sintoma) não têm outro lugar na lista. "Já dei" cria uma dose nova com os dados da dose atrasada e a data de hoje, e o próximo cuidado passa a contar dela (RN-81). O formulário mantém todos os campos de cada tipo (RN-37, RN-38, RN-76 a RN-80). A opção "Fotografar a carteirinha" não foi feita: ler as vacinas de uma foto pede um serviço de OCR externo, que não foi aprovado.
8. A carteirinha (Carteirinha-Mobile) não tem número e não tem PDF: a API não tem número de carteirinha, e gerar PDF pede uma dependência nova. O QR code aparece na carteirinha depois que o tutor cria um link. "Copiar" virou "Mais" (o compartilhar do sistema), porque o app não tem acesso à área de transferência sem uma dependência nova. A opção "Incluir exames e laudos" mostra os exames sem os anexos (RN-83).
9. O mapa do mural (Mural-Mobile-Mapa) é o mapa do ADR 0023 (Leaflet e OpenStreetMap), com um marcador por ocorrência; o toque no marcador mostra o nome. Os marcadores não têm a foto do pet, como no canvas. Sem a localização do aparelho, o mural mostra tudo. O mural não mostra o nome da cidade, porque isso pede um serviço de geocodificação.
