# Backend

API do Nupii em Go. A arquitetura está em [docs/arquitetura.md](../docs/arquitetura.md).

Todos os comandos abaixo são executados no diretório `backend`.

## Como executar

A API precisa do Postgres e do emulador do Firebase Authentication do ambiente local. Crie o `deploy/.env` (ver o [README da raiz](../README.md)) e suba o banco, o servidor S3 e o emulador. O serviço `api` do compose usa a mesma porta 8080, então ele fica parado:

```bash
docker compose -f ../deploy/compose.yaml up -d --wait db s3 auth
```

Carregue as variáveis do `deploy/.env` no terminal, monte o endereço do banco e aponte para o emulador:

```bash
set -a; . ../deploy/.env; set +a
export DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB?sslmode=disable"
export FIREBASE_PROJECT_ID=demo-nupii
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export S3_ENDPOINT=http://127.0.0.1:8333
go run ./cmd/api
```

As variáveis `S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` já vêm do `deploy/.env`.

Com `FIREBASE_AUTH_EMULATOR_HOST`, a API aceita os tokens do emulador e não confere a assinatura deles. Ela escreve um aviso no log da subida. Essa variável nunca é definida na produção.

Na subida, a API espera o banco responder e aplica as migrations que faltam. Se o banco não responde em 30 segundos, o processo termina com erro.

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

Testes de integração, com o compose em execução e as variáveis `DATABASE_URL`, `FIREBASE_AUTH_EMULATOR_HOST` e `S3_ENDPOINT` definidas como na seção anterior:

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
| `internal/platform/httpx/` | Middleware HTTP: identificador e log de cada requisição |
| `internal/platform/postgres/` | Conexão com o banco e aplicação das migrations |
| `db/migrations/` | Arquivos SQL das migrations |
| `db/queries/` | Arquivos SQL das consultas, a entrada do `sqlc` |
| `sqlc.yaml` | Configuração do `sqlc`: qual arquivo de consultas gera qual pacote |
| `internal/identity/` | Módulo do tutor: validação do token das requisições, regras do registro, handlers de `/v1/me`. `identitydb/` é o código gerado das consultas |
| `internal/pets/` | Módulo de pets: regras dos dados (RN-48 a RN-56), operações de `/v1/pets`. `petsdb/` é o código gerado das consultas |
| `internal/platform/firebase/` | Validação do ID token com o Firebase Admin SDK |
| `internal/platform/storage/` | Armazenamento de objetos por URLs pré-assinadas (ADR 0015). `storagetest/` dá a configuração para os testes de integração |
| `internal/platform/postgres/postgrestest/` | Banco para os testes de integração |
| `Dockerfile` | Imagem da API: compila um binário estático e copia para uma imagem vazia, com usuário sem privilégio |
