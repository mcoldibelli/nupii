# Nupii

Plataforma para tutores de pets, com três partes: saúde do pet, mural de perdidos e achados, e identificação de cães pela foto do focinho.

## Estado

As fatias 0, 1 e 2 do [roteiro](docs/roteiro.md) estão prontas. O ambiente local sobe com um comando e o CI confere a API, o app, a integração e o serviço de inferência. O tutor cria a conta e entra pelo app, e cadastra os pets dele com foto de perfil. A fatia 3 está em andamento: o serviço de inferência transforma a foto de um focinho em um vetor. O andamento de cada fatia está nos milestones do GitHub.

## Como executar

Requisitos: Docker com o Compose. Para desenvolver a API: Go 1.26 ou mais novo.

1. Crie o arquivo de configuração do ambiente local:

   ```bash
   cp deploy/.env.example deploy/.env
   ```

   Abra o `deploy/.env` e preencha os dois valores vazios: `POSTGRES_PASSWORD` e `S3_SECRET_ACCESS_KEY`. Para gerar um valor: `openssl rand -hex 24`. O arquivo `deploy/.env` não entra no git.

2. Suba o ambiente local: a API, o banco, o servidor S3 e o emulador do Firebase Authentication. O comando constrói as imagens e espera os serviços ficarem prontos:

   ```bash
   docker compose -f deploy/compose.yaml up -d --wait
   ```

3. Chame a API:

   ```bash
   curl -i http://localhost:8080/v1/health
   ```

   Resposta esperada:

   ```
   HTTP/1.1 200 OK
   Content-Type: application/json
   X-Request-Id: <identificador da requisição>

   {"status":"ok"}
   ```

Para parar o ambiente local: `docker compose -f deploy/compose.yaml down`. Os dados ficam nos volumes. Para apagar também os dados, use `down -v`.

Se a sua instalação tem só o binário `docker-compose`, use esse nome no lugar de `docker compose`.

| Serviço | Endereço | Variáveis no `deploy/.env` |
|---|---|---|
| API | `http://localhost:8080` | |
| PostgreSQL 18 com PostGIS e pgvector | `localhost:5432` | `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` |
| SeaweedFS (protocolo S3) | `http://localhost:8333` | `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| Emulador do Firebase Authentication | `http://localhost:9099` | |

As contas criadas no emulador ficam na memória e somem quando o container reinicia. Os tutores continuam no banco. Use `down -v` para apagar os dois juntos.

Se você mudar a senha do banco depois da primeira subida, apague os dados com `down -v`: o Postgres só grava a senha quando cria o banco.

Para desenvolver a API, suba só o banco e o servidor S3 e execute a API com `go run`. Os comandos estão no README do [backend](backend/README.md).

Para executar o app, veja o README do [mobile](mobile/README.md).

Para executar o serviço de inferência, veja o README do [inference](inference/README.md).

O ambiente local não usa o projeto real do Firebase. Para ligar a API e o app no projeto real, execute `./deploy/firebase-setup.sh`: ele guia os passos do console e guarda cada valor fora do git.

## Documentos

| Documento | O que tem |
|---|---|
| [docs/visao.md](docs/visao.md) | Problema, usuários, escopo e o que fica fora do escopo. |
| [docs/requisitos.md](docs/requisitos.md) | Requisitos funcionais (RF), regras de negócio (RN) e requisitos não funcionais (RNF), com identificador. |
| [docs/arquitetura.md](docs/arquitetura.md) | Partes do sistema, módulos, tarefas, dados, convenções, testes e glossário. |
| [docs/roteiro.md](docs/roteiro.md) | Ordem de construção em fatias verticais, com o critério de pronto de cada uma. |
| [docs/adr/](docs/adr/) | Uma decisão de arquitetura por arquivo. |

## Decisões

| ADR | Decisão | Estado |
|---|---|---|
| [0001](docs/adr/0001-registrar-decisoes-em-adrs.md) | Registrar decisões de arquitetura em ADRs | aceito |
| [0002](docs/adr/0002-backend-go-monolito-modular.md) | Backend em Go, monólito modular | aceito |
| [0003](docs/adr/0003-estado-postgres-fila-no-banco.md) | Postgres como único estado, sem Redis, fila de tarefas no banco | aceito (servidor S3 local: ver o 0012) |
| [0004](docs/adr/0004-acesso-a-dados.md) | pgx e sqlc para consultas, goose para migrations | aceito |
| [0005](docs/adr/0005-contrato-openapi.md) | Contrato da API em OpenAPI, escrito antes do código | aceito |
| [0006](docs/adr/0006-mobile-expo-web-publica.md) | App em React Native com Expo, web pública mínima | aceito (a forma da web: decisão na fatia 4) |
| [0007](docs/adr/0007-inferencia-python-onnx.md) | Inferência em serviço Python separado, sem torch | aceito |
| [0008](docs/adr/0008-autenticacao-firebase.md) | Autenticação com Firebase Authentication | aceito |
| [0009](docs/adr/0009-idioma.md) | Código em inglês, documentação em português | aceito |
| [0010](docs/adr/0010-ferramentas-de-teste.md) | Ferramentas de teste | aceito |
| [0011](docs/adr/0011-runtime-do-oapi-codegen.md) | Biblioteca de runtime do código gerado pelo oapi-codegen | aceito |
| [0012](docs/adr/0012-servidor-s3-local.md) | SeaweedFS como servidor S3 do ambiente local | aceito |
| [0013](docs/adr/0013-firebase-no-app.md) | SDK JavaScript do Firebase no app | aceito |
| [0014](docs/adr/0014-emulador-do-firebase-auth.md) | Emulador do Firebase Authentication no ambiente local e no CI | aceito |
| [0015](docs/adr/0015-cliente-de-armazenamento.md) | Cliente do armazenamento de objetos com a biblioteca padrão | aceito |
| [0016](docs/adr/0016-navegacao-e-foto-no-app.md) | Navegação com Expo Router e seleção de foto com Expo Image Picker | aceito |
| [0017](docs/adr/0017-arquivo-do-aparelho-no-app.md) | Expo File System para enviar um arquivo do aparelho | aceito |
| [0018](docs/adr/0018-python-e-dependencias-da-inferencia.md) | Python, dependências e ferramentas do serviço de inferência | aceito |
| [0019](docs/adr/0019-dados-do-teste-de-igualdade.md) | Dados do teste de igualdade da inferência | aceito |

## Regras do projeto

- Toda decisão que não é trivial vira um ADR antes do código.
- Nenhuma dependência entra sem estar em um ADR aceito.
- Nenhuma senha, chave secreta ou token fica no repositório, em issue ou em PR. Os valores ficam em arquivos `.env`, fora do git, e nos secrets do CI.
- Toda tarefa em trabalho é uma issue no GitHub, criada antes de o trabalho começar.
- Cada issue tem um branch próprio, que entra em `develop` por PR. Nenhuma mudança entra direto em `main`.
- Toda fatia do roteiro termina com teste executado e documento atualizado.
- Uma decisão ou uma implementação que muda o que um documento diz atualiza esse documento na mesma mudança.
