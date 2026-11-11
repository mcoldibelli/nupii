# Backend

API do Nupii em Go. A arquitetura está em [docs/arquitetura.md](../docs/arquitetura.md).

Todos os comandos abaixo são executados no diretório `backend`.

## Como executar

A API precisa do Postgres, do servidor S3, do emulador do Firebase Authentication e do serviço de inferência do ambiente local. Crie o `deploy/.env` e baixe os arquivos de pesos (ver o [README da raiz](../README.md)), e suba esses quatro serviços. O serviço `api` do compose usa a mesma porta 8080, então ele fica parado:

```bash
docker compose -f ../deploy/compose.yaml up -d --wait db s3 auth inference
```

Carregue as variáveis do `deploy/.env` no terminal, monte o endereço do banco e aponte para o emulador:

```bash
set -a; . ../deploy/.env; set +a
export DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB?sslmode=disable"
export FIREBASE_PROJECT_ID=demo-nupii
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export S3_ENDPOINT=http://127.0.0.1:8333
export INFERENCE_URL=http://127.0.0.1:8000
go run ./cmd/api
```

As variáveis `S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` já vêm do `deploy/.env`.

Com `FIREBASE_AUTH_EMULATOR_HOST`, a API aceita os tokens do emulador e não confere a assinatura deles. Ela escreve um aviso no log da subida. Essa variável nunca é definida na produção.

Na subida, a API espera o banco responder e aplica as migrations que faltam. Se o banco não responde em 30 segundos, o processo termina com erro.

Depois de subir, a API executa as tarefas da fila que esperam no banco, também as gravadas com a API parada (RNF-01). Ela também calcula de novo os vetores dos focinhos gravados com outra versão do modelo (RF-15). Ela atende requisições durante esse trabalho, e o resultado aparece em uma linha do log: `recompute of the noseprint vectors ended` ou `stopped`.

Em outro terminal:

```bash
curl -i http://localhost:8080/v1/health
```

Resposta esperada:

```
HTTP/1.1 200 OK
Content-Type: application/json
X-Request-Id: 3KEHFAIGP7DRXV4JW5JCJGDULV

{"status":"ok"}
```

O processo escreve o log em JSON na saída padrão, uma linha por requisição, com o mesmo `request_id` do cabeçalho `X-Request-Id`.

Para parar, use `Ctrl+C`. O processo termina as requisições em curso antes de sair, com limite de 10 segundos.

## Como testar

Testes de unidade, sem banco:

```bash
go test -race ./...
```

Testes de integração, com o compose em execução e as variáveis `DATABASE_URL`, `FIREBASE_AUTH_EMULATOR_HOST`, `S3_ENDPOINT` e `INFERENCE_URL` definidas como na seção anterior:

```bash
go test -race -tags=integration ./...
```

Sem essas variáveis, um teste de integração falha. Ele não é pulado.

## Lint

Formatação com `gofmt` e conferência com `go vet`. O comando termina com erro no primeiro problema:

```bash
./lint.sh
```

## Variáveis de ambiente

O processo não sobe com um valor inválido. Ele escreve o erro na saída de erro e termina com o código 1.

| Variável | Obrigatória | Padrão | Significado |
|---|---|---|---|
| `HTTP_ADDR` | Não | `:8080` | Endereço em que o servidor HTTP escuta, no formato `host:porta` |
| `DATABASE_URL` | Sim | | URL de conexão do Postgres, com o esquema `postgres` ou `postgresql`. Ela tem a senha: não fica no repositório e não é escrita no log |
| `FIREBASE_PROJECT_ID` | Sim | | Identificador do projeto do Firebase. A API só aceita ID tokens desse projeto. No ambiente local é `demo-nupii` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Não | | Arquivo da chave da conta de serviço do Firebase. Com ele, e sem o emulador, a API envia push (RN-36). Sem ele, a notificação fica só na lista |
| `INFERENCE_URL` | Sim | | Endereço do serviço de inferência, com `http://` ou `https://`. A API sobe sem o serviço responder |
| `S3_ENDPOINT` | Sim | | Endereço do armazenamento de objetos visto pela API, com `http://` ou `https://` |
| `S3_PUBLIC_ENDPOINT` | Não | o valor de `S3_ENDPOINT` | Endereço do armazenamento visto pelos clientes da API. Ele vai nas URLs temporárias |
| `S3_BUCKET` | Sim | | Bucket das fotos e dos anexos |
| `S3_REGION` | Não | `us-east-1` | Região usada na assinatura das requisições |
| `S3_ACCESS_KEY_ID` | Sim | | Identificador da chave de acesso |
| `S3_SECRET_ACCESS_KEY` | Sim | | Segredo da chave de acesso. Não fica no repositório e não é escrito no log |
| `FIREBASE_AUTH_EMULATOR_HOST` | Não | | Endereço `host:porta` do emulador do Authentication. Só no ambiente local e no CI. A API só aceita essa variável com um `FIREBASE_PROJECT_ID` que começa com `demo-` |

## Projeto real do Firebase

O ambiente local usa o emulador. Para ligar a API e o app no projeto real, execute o roteiro guiado na raiz do repositório:

```bash
./deploy/firebase-setup.sh
```

O roteiro abre as páginas do console do Firebase, diz o que fazer em cada uma e guarda os valores:

| Valor | Onde fica |
|---|---|
| `FIREBASE_PROJECT_ID` e `GOOGLE_APPLICATION_CREDENTIALS` | `backend/.env`, fora do git |
| Chave da conta de serviço (segredo) | `~/.config/nupii/firebase-service-account.json`, fora do repositório, com acesso só para o dono |
| Configuração do app | `mobile/.env`, fora do git |

Para subir a API com o projeto real, carregue também o `backend/.env` e não defina `FIREBASE_AUTH_EMULATOR_HOST`:

```bash
set -a; . ../deploy/.env; . ./.env; set +a
export DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB?sslmode=disable"
unset FIREBASE_AUTH_EMULATOR_HOST
go run ./cmd/api
```

Sem `FIREBASE_AUTH_EMULATOR_HOST`, o Firebase Admin SDK lê a credencial do arquivo de `GOOGLE_APPLICATION_CREDENTIALS`. Sem essa credencial, a API não sobe.

## Migrations

As migrations ficam em `db/migrations/`, em SQL, no formato do goose: um arquivo por mudança, com o número na frente do nome (`00001_extensions.sql`). A API aplica na subida as que ainda não foram aplicadas. A tabela `goose_db_version` do banco guarda quais já foram.

Uma migration aplicada não é editada. Uma mudança no esquema é um arquivo novo.

## Consultas SQL com sqlc

As consultas ficam em `db/queries/`, um arquivo por módulo. O `sqlc` lê as consultas e as migrations e gera um pacote Go por módulo (por exemplo `internal/identity/identitydb/`). O código gerado não é editado à mão.

Depois de mudar uma consulta ou uma migration:

```bash
go generate ./...
go test -race -tags=integration ./...
```

Regras das consultas:

- Cada consulta lista as colunas. `SELECT *` não é usado.
- Os testes de integração de consultas usam uma transação que é desfeita no fim. Eles não deixam linhas no banco.

## Código gerado do contrato

O arquivo `internal/api/api.gen.go` é gerado a partir de [api/openapi.yaml](../api/openapi.yaml). Ele não é editado à mão.

Depois de mudar o contrato:

```bash
go generate ./...
go test ./...
```

A primeira execução baixa o `oapi-codegen` na versão fixada em `internal/api/generate.go`.

## Onde fica cada parte

| Caminho | O que tem |
|---|---|
| `cmd/api/main.go` | `main` e `run`: lê a configuração, abre o banco, aplica as migrations, sobe o servidor HTTP e trata o sinal de parada |
| `cmd/api/main.go` (`healthcheck`) | O comando `api healthcheck` chama o health da própria API. A verificação de saúde do container usa esse comando, porque a imagem não tem shell |
| `cmd/api/server.go` | O tipo que implementa as operações do contrato, e a montagem do handler |
| `internal/api/` | Código gerado do contrato |
| `internal/platform/config/` | Leitura e validação das variáveis de ambiente |
| `internal/platform/httpx/` | Middleware HTTP: identificador e log de cada requisição, limite do corpo, limite de chamadas dos endpoints públicos (RN-43) e leitura de um corpo multipart |
| `internal/platform/postgres/` | Conexão com o banco e aplicação das migrations |
| `db/migrations/` | Arquivos SQL das migrations |
| `db/queries/` | Arquivos SQL das consultas, a entrada do `sqlc` |
| `sqlc.yaml` | Configuração do `sqlc`: qual arquivo de consultas gera qual pacote |
| `internal/identity/` | Módulo do tutor: validação do token das requisições, regras do registro, handlers de `/v1/me`. `identitydb/` é o código gerado das consultas |
| `internal/biometrics/` | Módulo de biometria: cadastro do focinho (RN-07 a RN-09, RN-59, RN-60), identificação (RN-10 a RN-15, RN-61, RN-62), confirmação (RN-16, RN-63 a RN-65), avisos de encontro (RN-66) e recálculo dos vetores (RN-67). `biometricsdb/` é o código gerado das consultas |
| `internal/alerts/` | Módulo de alertas: última localização (RN-30), dispositivos (RN-31), notificações (RN-35, RN-74), as tarefas que criam as notificações (RN-32 a RN-34, RN-73) e o envio de push (RN-36). `alertsdb/` é o código gerado das consultas |
| `internal/health/` | Módulo de saúde: eventos dos cinco tipos (RN-37, RN-38, RN-76 a RN-80), anexos (RN-82), próximos cuidados (RN-81) e links da carteirinha (RN-39 a RN-41, RN-83). `healthdb/` é o código gerado das consultas |
| `internal/reports/` | Módulo de ocorrências: perdido, achado, avistamento, resolver, mural e ficha (RN-24 a RN-29, RN-68 a RN-72). `reportsdb/` é o código gerado das consultas |
| `internal/platform/inference/` | Cliente do serviço de inferência |
| `internal/platform/jobs/` | Fila de tarefas no banco (ADR 0003, RNF-01, RNF-02) |
| `internal/platform/imagefile/` | Tipo de um arquivo de imagem pelo conteúdo |
| `internal/pets/` | Módulo de pets: regras dos dados (RN-48 a RN-56), operações de `/v1/pets`. `petsdb/` é o código gerado das consultas |
| `internal/platform/firebase/` | Validação do ID token com o Firebase Admin SDK |
| `internal/platform/storage/` | Armazenamento de objetos por URLs pré-assinadas (ADR 0015), com a leitura de um objeto (ADR 0020). `storagetest/` dá a configuração para os testes de integração |
| `internal/platform/postgres/postgrestest/` | Banco para os testes de integração |
| `Dockerfile` | Imagem da API: compila um binário estático e copia para uma imagem vazia, com usuário sem privilégio |
