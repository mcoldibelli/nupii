# Nupii

Plataforma para tutores de cães, com três partes:
- a saúde do pet;
- o mural de perdidos e achados;
- a identificação de um cão pela foto do focinho.

A aplicação está publicada em [app.nupii.com.br](https://app.nupii.com.br), e a API em [api.nupii.com.br](https://api.nupii.com.br).

O app (Expo, Android e web) consome a API própria, escrita em Go. A API usa o PostgreSQL e chama um serviço de IA em Python, que transforma a foto do focinho num vetor. O Firebase Authentication cuida das contas e das senhas.

## Entregáveis

| Entregável | Onde está |
|---|---|
| Código da API | [`backend/`](backend/) (Go). Contrato OpenAPI em [`api/openapi.yaml`](api/openapi.yaml) |
| Código do front-end | [`mobile/`](mobile/) (React Native com Expo: app Android e web) |
| Serviço de IA (integração) | [`inference/`](inference/) (Python e ONNX) |
| Scripts SQL do banco | [`backend/db/migrations/`](backend/db/migrations/) (criação das tabelas) e [`backend/db/queries/`](backend/db/queries/) (consultas) |
| Testes automatizados | `backend/**/*_test.go`, `mobile/src/**/*.test.ts` e [`inference/tests/`](inference/tests/). Veja [Como testar](#como-testar) |
| Dependências | [`backend/go.mod`](backend/go.mod), [`mobile/package.json`](mobile/package.json) e [`inference/requirements.txt`](inference/requirements.txt) |
| Exemplos de configuração | [`deploy/.env.example`](deploy/.env.example), [`mobile/.env.example`](mobile/.env.example) e [`deploy/.env.prod.example`](deploy/.env.prod.example) |

## Documentação

| Assunto | Documento |
|---|---|
| Problema e solução | [docs/visao.md](docs/visao.md) |
| Requisitos (RF, RN, RNF) | [docs/requisitos.md](docs/requisitos.md) |
| Casos de uso | [docs/casos-de-uso.md](docs/casos-de-uso.md) |
| Tecnologias, arquitetura e organização | [docs/arquitetura.md](docs/arquitetura.md) |
| Modelo conceitual | [docs/dominio.md](docs/dominio.md) |
| Modelo lógico (DER) | [docs/modelo-de-dados.md](docs/modelo-de-dados.md) |
| Endpoints da API | [api/openapi.yaml](api/openapi.yaml) e [docs/arquitetura.md](docs/arquitetura.md), seção API |
| Autenticação | [docs/arquitetura.md](docs/arquitetura.md), seção API, e [ADR 0008](docs/adr/0008-autenticacao-firebase.md) |
| Integrações externas | [docs/arquitetura.md](docs/arquitetura.md), seções Contexto e Serviço de inferência |
| Testes | [docs/arquitetura.md](docs/arquitetura.md), seção Testes |
| Decisões de arquitetura | [docs/adr/](docs/adr/), com o índice no fim deste arquivo |
| Ordem de construção | [docs/roteiro.md](docs/roteiro.md) |

## Como executar

Requisitos: Docker com o Compose, e o GitHub CLI (`gh`) com acesso ao repositório.

```bash
cp deploy/.env.example deploy/.env      # preencha POSTGRES_PASSWORD e S3_SECRET_ACCESS_KEY (openssl rand -hex 24)
cp mobile/.env.example mobile/.env
./inference/download_weights.sh          # pesos do modelo, conferidos por SHA-256

./dev.sh emulador   # API, banco, S3, IA e o emulador do Firebase (contas de teste)
./dev.sh web        # em outro terminal: a web em http://localhost:8081
```

- **Projeto real do Firebase:** use `./dev.sh firebase` no lugar de `./dev.sh emulador`. Antes, rode `./deploy/firebase-setup.sh` uma vez.
- **App no emulador Android:** use `./dev.sh app` no lugar de `./dev.sh web`.
- **Outros comandos:** `./dev.sh status`, `./dev.sh logs [serviço]` e `./dev.sh stop`.
- **Detalhes:** veja os READMEs do [backend](backend/README.md), do [mobile](mobile/README.md) e do [inference](inference/README.md).

Para conferir a API: `curl -i http://localhost:8080/v1/health` responde `200` com `{"status":"ok"}`.

## Como testar

```bash
cd backend && go test -race ./...                           # unidade
cd backend && go test -race -tags=integration ./...         # integração e contrato (com o ambiente local no ar)
cd mobile && npm test                                       # Jest
cd inference && pip install -r requirements-dev.txt && pytest
```

O CI roda os mesmos testes em cada PR (`.github/workflows/`).

## Publicação

A publicação vai para uma VPS com `./deploy/publish.sh`, a partir do `main`. O processo está no [ADR 0029](docs/adr/0029-publicacao-na-vps.md), e a observabilidade no [ADR 0032](docs/adr/0032-observabilidade-lgtm.md). O Grafana é de uso interno e abre só por túnel SSH: `ssh -L 3000:127.0.0.1:8092 vps`, depois `http://localhost:3000`, com o usuário `admin` e a senha `GRAFANA_ADMIN_PASSWORD` do `/opt/nupii-self/.env`.

## Regras do projeto

- Nenhuma senha, chave ou token fica no repositório: os valores ficam em arquivos `.env`, fora do git, e nos secrets do CI.
- Toda tarefa é uma issue, com um branch próprio que entra em `develop` por PR. Nenhuma mudança entra direto em `main`.
- Toda decisão que não é trivial vira um ADR. Nenhuma dependência entra sem estar num ADR aceito.
- Uma mudança que altera o que um documento diz atualiza esse documento no mesmo PR.

## Decisões de arquitetura

<details>
<summary>Índice dos ADRs (0001 a 0035)</summary>

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
| [0029](docs/adr/0029-publicacao-na-vps.md) | Publicação na VPS, endereço do cliente atrás do proxy, CORS da web com conta, login com Google, build do app e cópia do banco | aceito |
| [0030](docs/adr/0030-visual-do-app.md) | Visual do app a partir do canvas de design, com Bricolage Grotesque, Figtree e ícones em SVG | aceito |
| [0031](docs/adr/0031-copiar-para-a-area-de-transferencia.md) | Copiar o link da carteirinha com o expo-clipboard | aceito |
| [0032](docs/adr/0032-observabilidade-lgtm.md) | Observabilidade na VPS com Grafana, Loki, Tempo, Prometheus e Alloy | aceito |
| [0033](docs/adr/0033-reduzir-fotos-antes-do-envio.md) | Reduzir as fotos de perfil e de achado antes do envio, com o expo-image-manipulator | aceito |
| [0034](docs/adr/0034-focinho-na-web.md) | Foto do focinho na web: recorte em PNG sem nova compressão, webcam e HEIC com a heic2any | aceito |
| [0035](docs/adr/0035-nunito-na-landing.md) | Fonte Nunito na landing, com o @expo-google-fonts/nunito | aceito |

</details>
