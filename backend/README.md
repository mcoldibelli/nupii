# Backend

API do Nupii em Go. A arquitetura está em [docs/arquitetura.md](../docs/arquitetura.md).

Todos os comandos abaixo são executados no diretório `backend`.

## Como executar

A API precisa do Postgres do ambiente local. Crie o `deploy/.env` (ver o [README da raiz](../README.md)) e suba só o banco e o servidor S3. O serviço `api` do compose usa a mesma porta 8080, então ele fica parado:

```bash
docker compose -f ../deploy/compose.yaml up -d --wait db s3
```

Carregue as variáveis do `deploy/.env` no terminal e monte o endereço do banco:

```bash
set -a; . ../deploy/.env; set +a
export DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB?sslmode=disable"
go run ./cmd/api
```

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

Testes de integração, com o compose em execução e o `DATABASE_URL` definido como na seção anterior:

```bash
go test -race -tags=integration ./...
```

Sem o `DATABASE_URL`, um teste de integração falha. Ele não é pulado.

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

## Migrations

As migrations ficam em `db/migrations/`, em SQL, no formato do goose: um arquivo por mudança, com o número na frente do nome (`00001_extensions.sql`). A API aplica na subida as que ainda não foram aplicadas. A tabela `goose_db_version` do banco guarda quais já foram.

Uma migration aplicada não é editada. Uma mudança no esquema é um arquivo novo.

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
| `Dockerfile` | Imagem da API: compila um binário estático e copia para uma imagem vazia, com usuário sem privilégio |
