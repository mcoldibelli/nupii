# Mobile

App do Nupii em React Native com Expo e TypeScript. A arquitetura está em [docs/arquitetura.md](../docs/arquitetura.md).

Todos os comandos abaixo são executados no diretório `mobile`.

## Como executar

Requisitos: Node 22.13 ou mais novo, e a API em execução (ver o [README da raiz](../README.md)).

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo de configuração e ajuste o endereço da API:

   ```bash
   cp .env.example .env
   ```

   | Onde o app executa | Valor de `EXPO_PUBLIC_API_URL` |
   |---|---|
   | Emulador Android | `http://10.0.2.2:8080` |
   | Simulador iOS | `http://localhost:8080` |
   | Aparelho real, com o Expo Go | `http://<IP da sua máquina na rede local>:8080` |

3. Suba o app:

   ```bash
   npm run android
   ```

   Use `npm run ios` para o simulador iOS. Use `npm start` e leia o QR code com o Expo Go para um aparelho real.

A tela mostra `API: ok` quando a API responde. Ela mostra `API indisponível (<código>)` quando a API devolve um erro ou não responde.

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

| Variável | Obrigatória | Significado |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Sim | Endereço da API. O Expo copia para o pacote do app toda variável que começa com `EXPO_PUBLIC_`, então ela não pode ter segredo |

O arquivo `.env` não entra no git.

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
| `App.tsx` | A tela inicial: chama o health da API e mostra o resultado |
| `src/api/schema.d.ts` | Tipos gerados do contrato |
| `src/api/health.ts` | A chamada de `GET /v1/health` |
| `src/api/health.test.ts` | Testes de unidade da chamada |
