# Arquitetura

Este documento descreve as partes do sistema e as regras entre elas. Cada escolha aponta para o ADR que a justifica. Os requisitos estão em [requisitos.md](requisitos.md).

## Contexto

```mermaid
flowchart LR
    tutor([Tutor]) --> app[App mobile]
    visitante([Visitante sem conta]) --> web[Web pública]
    app --> api[API Go]
    web --> api
    api --> pg[(Postgres\nPostGIS + pgvector)]
    api --> s3[(Armazenamento S3)]
    api --> inf[Inferência Python]
    api --> fcm[FCM]
    app --> fa[Firebase Authentication]
    api --> fa
```

| Parte | Responsabilidade | ADR |
|---|---|---|
| App mobile | Tudo que o tutor faz: conta, pets, saúde, focinho, ocorrências, alertas. | [0006](adr/0006-mobile-expo-web-publica.md), [0016](adr/0016-navegacao-e-foto-no-app.md) |
| Web pública | O que o visitante faz sem instalar nada: mural, ficha, "encontrei um pet", avistamento, carteirinha por link. | [0006](adr/0006-mobile-expo-web-publica.md) |
| API Go | Um binário. Regras de negócio, acesso ao banco, tarefas em segundo plano. | [0002](adr/0002-backend-go-monolito-modular.md) |
| Postgres | Único estado: dados, busca geográfica, busca por vetor, fila de tarefas. | [0003](adr/0003-estado-postgres-fila-no-banco.md) |
| Armazenamento S3 | Fotos e anexos. SeaweedFS no ambiente local. | [0003](adr/0003-estado-postgres-fila-no-banco.md), [0012](adr/0012-servidor-s3-local.md), [0015](adr/0015-cliente-de-armazenamento.md) |
| Inferência Python | Foto do focinho para vetor. Sem estado. | [0007](adr/0007-inferencia-python-onnx.md) |
| Firebase Authentication | Identidade do tutor: senha, sessão, login com Google, redefinição de senha. No ambiente local e no CI, o emulador. | [0008](adr/0008-autenticacao-firebase.md), [0013](adr/0013-firebase-no-app.md), [0014](adr/0014-emulador-do-firebase-auth.md) |

## Estrutura do repositório

Um repositório com três projetos e a documentação.

```
backend/
  cmd/api/              main: lê a configuração, liga os módulos, sobe HTTP e os workers
  internal/
    identity/           tutor, validação do ID token, termos, exclusão de conta
    pets/               pets e foto de perfil
    biometrics/         cadastro do focinho, identificação, confirmação, recálculo
    reports/            perdido, achado, avistamento, mural
    alerts/             localização, dispositivos, notificações, push
    health/             eventos de saúde, anexos, carteirinha compartilhada
    api/                código gerado do contrato (tipos e interface do servidor), não editado à mão
    platform/           postgres, storage, jobs, httpx (middleware), config, firebase, inference
  db/migrations/        SQL das migrations
  db/queries/           SQL das consultas (entrada do sqlc)
api/openapi.yaml        contrato da API
mobile/                 projeto Expo (app e web pública, ver a nota abaixo)
inference/              serviço Python
deploy/                 compose e arquivos de publicação
docs/                   este diretório
```

Nota: a forma da web pública é decidida na fatia 4 ([ADR 0006](adr/0006-mobile-expo-web-publica.md)). Até lá, a hipótese é o alvo web do mesmo projeto Expo.

O módulo Go fica em `backend/` e não na raiz. Motivo: `go build ./...` na raiz entra em `mobile/node_modules`.

## Módulos do backend

Regras, iguais para todos os módulos:

1. Um módulo é um pacote Go. Ele tem os tipos do domínio, o serviço, as consultas e os handlers HTTP daquele domínio.
2. Um módulo escreve só nas próprias tabelas.
3. Um módulo chama outro módulo por uma interface declarada em quem consome. Exemplo: `reports` declara a interface `PetOwnerChecker`, e `pets` a satisfaz.
4. Leitura com `JOIN` entre tabelas de módulos diferentes é permitida e fica listada abaixo. É o custo aceito de um banco único.
5. `platform` não conhece nenhum módulo de domínio.

Dependências permitidas:

```mermaid
flowchart TD
    reports --> pets
    reports --> alerts
    biometrics --> pets
    biometrics --> alerts
    health --> pets
    pets --> identity
    alerts --> identity
    identity --> platform
    pets --> platform
    biometrics --> platform
    reports --> platform
    alerts --> platform
    health --> platform
```

Leituras com `JOIN` entre módulos, conhecidas pelos requisitos:

| Consulta | Módulo dono | Lê também | Requisito |
|---|---|---|---|
| Busca dos focinhos mais parecidos | `biometrics` | `pets` (pet não excluído), `identity` (conta ativa) | RN-10, RN-11 |
| Tutores perto de um ponto | `alerts` | `identity` (conta ativa) | RN-32, RN-33 |
| Mural com a foto do pet | `reports` | `pets` | RF-16 |

## Tarefas em segundo plano

Uma tabela `jobs` no Postgres. Workers no mesmo binário leem com `SELECT ... FOR UPDATE SKIP LOCKED` ([ADR 0003](adr/0003-estado-postgres-fila-no-banco.md)).

| Tarefa | Quem cria | Requisito |
|---|---|---|
| `notify_lost_report` | `reports`, na mesma transação da ocorrência | RF-24, RNF-01 |
| `send_push` | `alerts` | RF-26 |
| `reembed_noseprint` | `biometrics`, quando a versão do modelo muda | RF-15 |
| `purge_expired_data` | agenda diária | RF-32, RN-42 |
| `delete_identity_user` | `identity`, na mesma transação da anonimização | RF-08, RN-03 |

Concorrência, declarada por regra:

- O contexto raiz nasce em `main` e é cancelado por `SIGTERM`.
- Cada worker para quando o contexto é cancelado e termina a tarefa em curso antes de sair.
- Uma tarefa que falha volta para a fila com espera crescente. Depois do limite de tentativas ela fica marcada como falha.
- Toda tarefa precisa ser segura para executar duas vezes.

## Dados

- PostgreSQL com PostGIS (distância) e pgvector (vetores com índice HNSW e cosseno).
- O esquema nasce das migrations de `backend/db/migrations/`. As migrations são a fonte do modelo de dados.
- A API aplica as migrations pendentes quando sobe, antes de aceitar requisições. A primeira migration cria as extensões PostGIS e pgvector.
- `GET /v1/health` responde 503 com o código `unavailable` quando o banco não responde.
- Nomes de tabelas e colunas em inglês ([ADR 0009](adr/0009-idioma.md)).
- Chaves primárias UUID.

## API

- `api/openapi.yaml` é a fonte do contrato. Os tipos do Go e do TypeScript são gerados dele ([ADR 0005](adr/0005-contrato-openapi.md)).
- O contrato usa a OpenAPI 3.1.
- O código Go é gerado em `backend/internal/api/` pelo `oapi-codegen`, no modo `strict-server`: cada handler recebe um tipo de requisição e devolve um dos tipos de resposta que o contrato declara. O comando é `go generate ./...`, no diretório `backend`.
- Os tipos TypeScript são gerados em `mobile/src/api/schema.d.ts` pelo `openapi-typescript`. O comando é `npm run generate:api`, no diretório `mobile`. O gerador é executado com `npx`, fora das dependências do app.
- O código gerado é versionado. O CI falha se ele estiver diferente do contrato.
- O teste `TestContractIsValid` confere que o contrato é um documento OpenAPI válido.
- Erros em um formato único: `{"error": "<código>", "message": "<texto>"}`. O código é estável e o app decide a mensagem pela tabela de códigos.
- Os códigos de erro estão no contrato, no schema `ErrorCode`. Um código novo entra no contrato antes de entrar no servidor.
- Uma rota que não existe e um método que a rota não aceita recebem 404 com o código `not_found`. O 405 não é usado.
- Uma rota com `GET` atende também `HEAD`, com a mesma resposta sem o corpo. É o comportamento do `http.ServeMux`.
- Um erro devolvido por uma operação, ou um panic em um handler, recebe 500 com o código `internal_error`. O detalhe do erro vai só para o log, com o identificador da requisição.
- Rotas em inglês, com versão no caminho: `/v1/...`.
- Endpoints públicos têm limite de tentativas por IP (RN-43).
- Autenticação: uma operação do contrato sem `security` é pública. Toda outra operação pede o ID token do Firebase no cabeçalho `Authorization: Bearer`. Sem token válido, a resposta é 401 com o código `unauthenticated` (RN-46). A conferência do token acontece antes da leitura do corpo.
- O módulo `identity` depende da interface `TokenVerifier`. A implementação com o Firebase Admin SDK fica em `platform/firebase`, e `cmd/api` liga as duas.
- Um corpo ou um parâmetro que não pode ser lido recebe 400 com o código `invalid_request`. Um dado que quebra uma regra de negócio recebe a mesma resposta, com a regra na mensagem.
- Um recurso de outro tutor não existe para quem chama: a resposta é 404, igual à de um recurso que nunca existiu (RN-52).
- Uma conta sem tutor registrado recebe 404 com o código `owner_not_found` nas operações que precisam do tutor.
- O corpo de uma requisição tem no máximo 1 MiB. Um corpo maior recebe a mesma resposta 400.
- O emulador do Authentication só é aceito com um projeto de demonstração (`FIREBASE_PROJECT_ID` com o prefixo `demo-`). Com outro projeto, a API não sobe.
- Toda resposta tem o cabeçalho `X-Request-Id`, com o identificador que aparece nas linhas de log da requisição (RNF-07).

## Convenções

### Código

- Go: Effective Go, Go Code Review Comments e o guia de estilo da Uber. `gofmt` e `go vet` em toda mudança.
- Lint: um comando por projeto, usado no ambiente local e no CI. No backend é `./lint.sh` (`gofmt` e `go vet`). No app é `npm run lint` (conferência de tipos do TypeScript).
- Erros em Go: sempre com contexto e `%w`. Nenhum erro descartado.
- Log: `log/slog` com saída JSON e um identificador por requisição.
- Configuração: variáveis de ambiente, lidas uma vez em `main` e validadas na subida. O processo não sobe com configuração inválida.
- Segredos: nenhuma senha, chave secreta ou token fica no repositório, em issue ou em PR. Onde há segredo, um arquivo `.env.example` versionado tem os nomes das variáveis, sem os valores secretos. Os valores ficam em um arquivo `.env`, que o `.gitignore` exclui. No CI, eles ficam nos secrets do GitHub Actions ou são gerados em cada execução.
- TypeScript: modo `strict`.

### Git

- Toda tarefa em trabalho é uma issue no GitHub, criada antes de o trabalho começar. Cada fatia do roteiro é um milestone, e a issue de uma tarefa fica no milestone da fatia dela. O andamento do projeto é lido nas issues e nos milestones.
- `develop` é o branch de integração e o branch padrão do repositório no GitHub. Cada issue tem um branch próprio, criado a partir de `develop` quando o trabalho da issue começa.
- Nome do branch de uma issue: `<tipo>/<número da issue>-<resumo em inglês>`. O tipo é o mesmo do Conventional Commits. Exemplo: `feat/8-backend-health`.
- Um PR por issue, com destino `develop`. O merge é por squash: uma issue vira um commit em `develop`, com o título do PR. A issue é fechada quando o PR dela entra em `develop`. O branch da issue é apagado logo depois do merge, no GitHub e no ambiente local.
- Nenhuma mudança entra direto em `main`. `main` recebe mudanças só por PR a partir de `develop`, no fim de cada fatia do roteiro. A regra vale por convenção: a proteção de branch do GitHub não está ligada. Esse PR entra com commit de merge, para `main` e `develop` terem o mesmo histórico.
- Commits no formato Conventional Commits, só com título, em inglês ([ADR 0009](adr/0009-idioma.md)).
- O CI precisa passar antes do merge.

### Documentação

- Um ADR por decisão, no formato de [ADR 0001](adr/0001-registrar-decisoes-em-adrs.md). Um ADR aceito não é editado: uma decisão nova cria um ADR novo que substitui o anterior.
- Uma decisão ou uma implementação que muda o que um documento diz atualiza esse documento no mesmo PR. Isso vale para este documento, para os requisitos, para o roteiro e para os READMEs.
- Um requisito em rascunho é fechado em [requisitos.md](requisitos.md) antes do código da fatia dele.
- Cada projeto (`backend`, `mobile`, `inference`) tem um README com três partes: como executar, como testar, variáveis de ambiente.

## Testes

| Nível | O que cobre | Como |
|---|---|---|
| Unidade (Go) | Regras de domínio: limiares, agrupamento por pet, estados da ocorrência | Testes de tabela, sem banco |
| Integração (Go) | Consultas SQL, PostGIS, pgvector, fila de tarefas | Postgres do compose, testes com a build tag `integration` |
| Contrato | A API responde o que o OpenAPI declara | Validação das respostas contra o `api/openapi.yaml` nos testes de integração |
| Inferência | O vetor do serviço é igual ao vetor de referência da calibração | Vetores de referência versionados junto do teste ([ADR 0007](adr/0007-inferencia-python-onnx.md)) |
| Mobile | Lógica pura e chamadas da API | Testes de unidade com Jest |

As ferramentas de cada nível estão no [ADR 0010](adr/0010-ferramentas-de-teste.md).

Regra: toda regra de negócio de [requisitos.md](requisitos.md) tem um teste que cita o identificador dela e usa o mesmo valor (exemplo: RN-13, similaridade mínima 0,351).

## CI

Os workflows ficam em `.github/workflows/`. Cada um é disparado só pelos arquivos que ele confere.

| Workflow | Disparado por | O que confere |
|---|---|---|
| `backend` | `backend/`, `api/` | Lint, código gerado igual ao contrato, testes de unidade com detector de corrida, build, e que as bibliotecas de teste não entram no binário |
| `mobile` | `mobile/`, `api/` | Instalação, tipos gerados iguais ao contrato, lint e testes de unidade |
| `integration` | `backend/`, `api/`, `deploy/` | Sobe o compose (API, banco, servidor S3 e emulador do Authentication), chama `GET /v1/health` e executa os testes de integração |

O workflow `integration` cria o `deploy/.env` com credenciais aleatórias em cada execução. Nenhum workflow tem credencial escrita.

## Glossário

O código usa o termo em inglês. A documentação e as telas usam o termo em português.

| Português | Inglês (código) | Significado |
|---|---|---|
| tutor | owner | Pessoa com conta, responsável por pets |
| conta | account | O usuário no provedor de identidade: e-mail e senha |
| identidade | identity | A conta que fez uma requisição, lida do ID token |
| termos de uso | terms | Texto que o tutor aceita no registro, com uma versão |
| visitante | visitor | Pessoa sem conta |
| pet | pet | Animal cadastrado |
| espécie | species | Cachorro, gato ou outro |
| raça | breed | Texto livre |
| porte | size | Pequeno, médio ou grande |
| castrado | neutered | Sim ou não |
| foto de perfil | profile photo | A foto que identifica o pet nas listas |
| focinho | nose | Região usada na biometria |
| cadastro biométrico | noseprint | Foto do focinho com o vetor |
| identificação | identification | Busca de um focinho no acervo |
| candidato | candidate | Pet devolvido por uma identificação |
| acervo | gallery | Conjunto de noseprints ativos de uma versão do modelo |
| ocorrência | report | Registro de perdido, achado ou avistado |
| perdido, achado, avistado | lost, found, sighting | Tipos de ocorrência |
| mural | board | Lista pública de ocorrências abertas |
| aviso, notificação | notification | Mensagem para um tutor |
| evento de saúde | health event | Vacina, consulta, medicação, exame ou anotação |
| carteirinha | health card | Resumo de saúde do pet |
| compartilhamento | share link | Link público da carteirinha |

## Fora da v1

Cada item entra quando o gatilho acontece.

| Item | Gatilho para entrar |
|---|---|
| Broker de eventos (Kafka, NATS) | Um segundo serviço precisa reagir aos mesmos eventos |
| Redis | Mais de uma instância da API (limite de tentativas compartilhado) |
| Métricas e tracing (OpenTelemetry) | A primeira publicação com usuários reais |
| Detector de focinho no aparelho | Depois da prova técnica descrita no [roteiro](roteiro.md) |
| Login com Apple | Publicação na App Store |
| Endpoints de administração | Uma tarefa de administração que se repete |
