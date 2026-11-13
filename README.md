# Nupii

Plataforma para tutores de pets, com três partes: saúde do pet, mural de perdidos e achados, e identificação de cães pela foto do focinho.

## Estado

As fatias 0, 1, 2 e 3 do [roteiro](docs/roteiro.md) estão prontas. O ambiente local sobe com um comando e o CI confere a API, o app, a integração e o serviço de inferência. O tutor cria a conta e entra pelo app, e cadastra os pets dele com foto de perfil. O serviço de inferência transforma a foto de um focinho em um vetor. As fatias 4 e 5 estão prontas: o tutor cadastra o focinho de um cachorro pelo app, e quem encontra um cão envia a foto do focinho pela página pública, vê os pets parecidos e deixa o contato para o tutor. O tutor registra o desaparecimento de um pet no mapa, e qualquer pessoa vê o mural, registra um avistamento e publica um achado pela web. A fatia 6 também está pronta: o tutor a até 3.000 m de um desaparecimento recebe uma notificação no app, mesmo que a API pare logo depois do registro. Na fatia 7, o tutor registra a saúde dos pets: vacinas, consultas, medicações, exames e anotações, com anexos e os próximos cuidados. Na fatia 8, o tutor compartilha a carteirinha do pet por um link com QR code, que qualquer pessoa abre na web até o tutor revogar. Na fatia 9, o tutor altera o perfil, troca e redefine a senha e exclui a conta, e a API apaga todo dia os dados pessoais com mais de 30 dias. O andamento de cada fatia está nos milestones do GitHub.

## Como testar o app

Um comando sobe o ambiente local e outro abre o app no emulador Android:

```bash
./dev.sh firebase   # ou ./dev.sh emulador
./dev.sh app
```

| Modo | Login | Arquivos que o comando confere |
|---|---|---|
| `emulador` | Emulador do Firebase Authentication (contas de teste, somem quando o container reinicia) | `deploy/.env`, `mobile/.env` com `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` preenchido (o `mobile/.env.example` já vem assim) |
| `firebase` | Projeto real do Firebase | `deploy/.env`, `backend/.env` com `FIREBASE_PROJECT_ID` e `GOOGLE_APPLICATION_CREDENTIALS`, e `mobile/.env` com `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` vazio. Os dois arquivos vêm do `./deploy/firebase-setup.sh` |

O comando para com uma mensagem quando falta um arquivo, um valor, os pesos do modelo, ou quando outro programa usa a porta 8080 (por exemplo, um `go run` da API). Ele avisa quando o app e a API usam modos diferentes do Firebase.

Para abrir no navegador os links que o app cria (carteirinha, mural, achado), suba a web pública com `./dev.sh web`: ela responde em `http://localhost:8081`, o endereço desses links no ambiente local.

Outros comandos: `./dev.sh status`, `./dev.sh logs [serviço]` e `./dev.sh stop`. O `./dev.sh app` usa o primeiro emulador Android criado (ou o da variável `AVD`) e o Expo na porta 8099 (ou a da variável `EXPO_PORT`).

Os passos detalhados de cada parte estão abaixo e nos READMEs do [backend](backend/README.md) e do [mobile](mobile/README.md).

## Como executar

Requisitos: Docker com o Compose, e o GitHub CLI (`gh`) com acesso ao repositório. Para desenvolver a API: Go 1.26 ou mais novo.

1. Crie o arquivo de configuração do ambiente local:

   ```bash
   cp deploy/.env.example deploy/.env
   ```

   Abra o `deploy/.env` e preencha os dois valores vazios: `POSTGRES_PASSWORD` e `S3_SECRET_ACCESS_KEY`. Para gerar um valor: `openssl rand -hex 24`. O arquivo `deploy/.env` não entra no git.

2. Baixe os arquivos de pesos do serviço de inferência. O script baixa os arquivos de uma release do repositório para `inference/models` e confere o SHA-256. Os arquivos não entram no git:

   ```bash
   ./inference/download_weights.sh
   ```

3. Suba o ambiente local: a API, o banco, o servidor S3, o emulador do Firebase Authentication e o serviço de inferência. O comando constrói as imagens e espera os serviços ficarem prontos:

   ```bash
   docker compose -f deploy/compose.yaml up -d --wait
   ```

4. Chame a API:

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
| Serviço de inferência | `http://localhost:8000` | |

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
| [0004](docs/adr/0004-acesso-a-dados.md) | pgx e sqlc para consultas, goose para migrations | aceito (tipo vetor: ver o 0021) |
| [0005](docs/adr/0005-contrato-openapi.md) | Contrato da API em OpenAPI, escrito antes do código | aceito |
| [0006](docs/adr/0006-mobile-expo-web-publica.md) | App em React Native com Expo, web pública mínima | aceito (a forma da web: ver o 0022) |
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
| [0020](docs/adr/0020-leitura-de-objeto-pelo-backend.md) | Leitura de um objeto do armazenamento pelo backend | aceito |
| [0021](docs/adr/0021-vetor-como-texto-nas-consultas.md) | Vetor como texto nas consultas, sem a biblioteca pgvector-go | aceito |
| [0022](docs/adr/0022-web-publica-no-alvo-web-do-expo.md) | Web pública no alvo web do mesmo projeto Expo | aceito |
| [0023](docs/adr/0023-mapa-com-leaflet.md) | Mapa com Leaflet e OpenStreetMap | aceito |
| [0024](docs/adr/0024-push-no-app.md) | Push no app com um build de desenvolvimento, na fatia 10 | aceito |
| [0025](docs/adr/0025-localizacao-no-app.md) | Localização do aparelho com Expo Location | aceito |
| [0026](docs/adr/0026-eventos-de-saude.md) | Eventos de saúde em uma tabela, e próximos cuidados calculados pela API | aceito |
| [0027](docs/adr/0027-link-da-carteirinha.md) | Link da carteirinha com validade de 30 dias, token no fragmento e QR code no app | aceito |
| [0028](docs/adr/0028-exclusao-da-conta-e-limpeza.md) | Exclusão da conta com um apagador por módulo, e limpeza diária às 3h de Brasília | aceito |
| [0030](docs/adr/0030-visual-do-app.md) | Visual do app a partir do canvas de design, com Bricolage Grotesque, Figtree e ícones em SVG | aceito |
| [0031](docs/adr/0031-copiar-para-a-area-de-transferencia.md) | Copiar o link da carteirinha com o expo-clipboard | aceito |

## Regras do projeto

- Toda decisão que não é trivial vira um ADR antes do código.
- Nenhuma dependência entra sem estar em um ADR aceito.
- Nenhuma senha, chave secreta ou token fica no repositório, em issue ou em PR. Os valores ficam em arquivos `.env`, fora do git, e nos secrets do CI.
- Toda tarefa em trabalho é uma issue no GitHub, criada antes de o trabalho começar.
- Cada issue tem um branch próprio, que entra em `develop` por PR. Nenhuma mudança entra direto em `main`.
- Toda fatia do roteiro termina com teste executado e documento atualizado.
- Uma decisão ou uma implementação que muda o que um documento diz atualiza esse documento na mesma mudança.
