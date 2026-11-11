# Mobile

App do Nupii em React Native com Expo e TypeScript. A arquitetura está em [docs/arquitetura.md](../docs/arquitetura.md).

Todos os comandos abaixo são executados no diretório `mobile`.

## Como executar

Requisitos: Node 22.13 ou mais novo, e o ambiente local em execução (ver o [README da raiz](../README.md)). O ambiente local tem a API e o emulador do Firebase Authentication.

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo de configuração:

   ```bash
   cp .env.example .env
   ```

   O arquivo já vem pronto para o emulador do Authentication e para o emulador Android. Para outro aparelho, troque os endereços:

   | Onde o app executa | API | Emulador do Authentication |
   |---|---|---|
   | Emulador Android | `http://10.0.2.2:8080` | `http://10.0.2.2:9099` |
   | Simulador iOS | `http://localhost:8080` | `http://localhost:9099` |
   | Aparelho real, com o Expo Go | `http://<IP da sua máquina>:8080` | `http://<IP da sua máquina>:9099` |

3. Suba o app:

   ```bash
   npm run android
   ```

   Use `npm run ios` para o simulador iOS. Use `npm start` e leia o QR code com o Expo Go para um aparelho real.

Para usar o projeto real do Firebase no lugar do emulador, execute `./deploy/firebase-setup.sh` na raiz do repositório. O roteiro preenche o `mobile/.env`.

## O que o app faz hoje

1. Tela de entrada: entrar ou criar conta, com e-mail e senha de no mínimo 8 caracteres.
2. No primeiro acesso: o tutor informa o nome e aceita os termos de uso. O app registra o tutor na API.
3. Lista de pets: a tela inicial. Mostra a foto, o nome e a espécie de cada pet, e a ação de sair.
4. Novo pet e editar pet: o formulário com os dados do pet e a foto de perfil, escolhida na galeria do aparelho. A tela de editar tem a ação de excluir.
5. Focinho: na tela de editar de um cachorro, a ação "Focinho do pet" abre o cadastro do focinho, com a câmera ou a galeria. A tela mostra o motivo quando a foto é recusada.
6. Avisos de encontro: a lista dos contatos de quem encontrou um pet do tutor.
7. Mural: as ocorrências abertas de perdidos e achados. A ficha de uma ocorrência tem o mapa, os avistamentos e o formulário de um novo avistamento.
8. Desaparecimento: na tela de editar pet, a ação "Registrar desaparecimento" abre o mapa para o tutor marcar o ponto. Com um desaparecimento aberto, a tela tem a ação "Marcar como encontrado".

O mapa é uma página com o Leaflet e os quadros do OpenStreetMap, dentro de um WebView ([ADR 0023](../docs/adr/0023-mapa-com-leaflet.md)). Ele precisa de internet.

## Web pública

A página "encontrei um pet" é a rota `/found` do mesmo projeto, no alvo web ([ADR 0022](../docs/adr/0022-web-publica-no-alvo-web-do-expo.md)). Ela não pede conta.

No navegador da sua máquina, a API fica em `localhost`, e não no endereço do emulador Android. Suba a web com o endereço certo:

```bash
EXPO_PUBLIC_API_URL=http://localhost:8080 npm run web
```

Abra `http://localhost:8081/found`. Para medir o JavaScript da página: `npx expo export -p web`. O orçamento é de 500 KB com gzip.

As fotos vêm do armazenamento por uma URL temporária. No emulador Android, o `deploy/.env` precisa de `S3_PUBLIC_ENDPOINT=http://10.0.2.2:8333`, para o aparelho alcançar o armazenamento da sua máquina.

A sessão continua depois de fechar o app. As contas do emulador somem quando o container do emulador reinicia: nesse caso a API recusa a sessão antiga e o app volta para a tela de entrada.

## Como testar

```bash
npm test
```

## Lint

O lint é a conferência de tipos do TypeScript, em modo `strict`:

```bash
npm run lint
```

## Variáveis de ambiente

O Expo copia para o pacote do app toda variável que começa com `EXPO_PUBLIC_`. Por isso nenhuma delas pode ter segredo. O arquivo `.env` não entra no git.

| Variável | Obrigatória | Significado |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Sim | Endereço da API |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Sim | Projeto do Firebase. Com o emulador: `demo-nupii` |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Sim | Chave do app no Firebase. Com o emulador, qualquer texto |
| `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` | Não | Endereço do emulador do Authentication. Vazio para usar o projeto real |

## Tipos gerados do contrato

O arquivo `src/api/schema.d.ts` é gerado a partir de [api/openapi.yaml](../api/openapi.yaml). Ele não é editado à mão.

Depois de mudar o contrato:

```bash
npm run generate:api
npm run lint
npm test
```

O gerador (`openapi-typescript`) é executado com `npx`, fora das dependências do app.

## Onde fica cada parte

| Caminho | O que tem |
|---|---|
| `app/` | As telas. Cada arquivo é uma rota do Expo Router |
| `app/_layout.tsx` | Layout raiz: cria a sessão e libera as telas pelo estado dela (sem conta, primeiro acesso, pronto) |
| `app/index.tsx` | Lista de pets |
| `app/pets/new.tsx`, `app/pets/[id].tsx` | Novo pet e editar pet |
| `app/noseprint/[petId].tsx` | Cadastro do focinho de um cachorro |
| `app/found-notices.tsx` | Avisos de encontro |
| `app/found.tsx` | Página pública "encontrei um pet" |
| `app/reports/index.tsx`, `app/reports/[id].tsx` | Mural e ficha de uma ocorrência |
| `app/reports/lost.tsx` | Registro do desaparecimento de um pet |
| `src/map/` | O mapa: a página HTML (`mapHtml.ts`, com testes), o WebView do app e o iframe da web |
| `src/reports/` | Regras dos textos de uma ocorrência (RN-70), títulos e mensagens, com testes; ações do desaparecimento na tela do pet |
| `app/sign-in.tsx`, `app/complete-profile.tsx` | Entrada e primeiro acesso |
| `src/session/SessionContext.tsx` | A conta e o tutor, para todas as telas |
| `src/config.ts` | Leitura das variáveis de ambiente |
| `src/terms.ts` | Versão e texto dos termos de uso que o app mostra |
| `src/auth/firebase.ts` | O único arquivo que importa o SDK do Firebase: entrar, criar conta, sair, token |
| `src/auth/validation.ts` | Regras dos formulários da conta (RN-01, RN-44, RN-45), com testes |
| `src/api/schema.d.ts` | Tipos gerados do contrato |
| `src/api/http.ts` | Envio de uma requisição, com o token ou sem token, e leitura da resposta |
| `src/api/owner.ts`, `src/api/pets.ts`, `src/api/biometrics.ts`, `src/api/found.ts` | Chamadas da API, com testes |
| `src/biometrics/messages.ts` | Mensagens das recusas da foto do focinho, com testes |
| `src/found/contact.ts` | Regras do contato de quem encontrou um cão (RN-63), com testes |
| `src/found/location.ts` | Posição do aparelho no navegador (RN-61), com testes |
| `src/pets/form.ts` | Regras do formulário do pet (RN-48, RN-50, RN-51, RN-56), com testes |
| `src/pets/save.ts` | Salva os dados do pet e depois envia a foto, com testes |
| `src/pets/PetFormView.tsx` | O formulário do pet |
| `src/pets/pickPhoto.ts` | O único arquivo que importa a galeria e o sistema de arquivos do aparelho |
| `src/screens/` | Telas de entrada e de primeiro acesso, e os estilos comuns |
