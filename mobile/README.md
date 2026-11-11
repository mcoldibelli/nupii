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

   Preencha `EXPO_PUBLIC_FIREBASE_API_KEY`. Com o emulador, qualquer texto serve. O arquivo já vem com os endereços do emulador Android. Para outro aparelho, troque os endereços:

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

## O que o app faz hoje

1. Tela de entrada: entrar ou criar conta, com e-mail e senha de no mínimo 8 caracteres.
2. No primeiro acesso: o tutor informa o nome e aceita os termos de uso. O app registra o tutor na API.
3. Tela inicial: mostra o nome e o e-mail do tutor, e a ação de sair.

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
| `App.tsx` | O estado do app: carregando, sem conta, primeiro acesso, pronto ou falha. Escolhe a tela |
| `src/config.ts` | Leitura das variáveis de ambiente |
| `src/terms.ts` | Versão e texto dos termos de uso que o app mostra |
| `src/auth/firebase.ts` | O único arquivo que importa o SDK do Firebase: entrar, criar conta, sair, token |
| `src/auth/validation.ts` | Regras dos formulários (RN-01, RN-44, RN-45), com testes |
| `src/api/schema.d.ts` | Tipos gerados do contrato |
| `src/api/owner.ts` | Chamadas de `GET /v1/me` e `POST /v1/me`, com testes |
| `src/screens/` | Telas: entrada, primeiro acesso e inicial |
