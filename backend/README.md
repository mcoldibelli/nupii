# Backend

API do Nupii em Go. A arquitetura está em [docs/arquitetura.md](../docs/arquitetura.md).

Todos os comandos abaixo são executados no diretório `backend`.

## Como executar

```bash
go run ./cmd/api
```

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

```bash
go test ./...
```

Com o detector de corrida:

```bash
go test -race ./...
```

## Variáveis de ambiente

O processo não sobe com um valor inválido. Ele escreve o erro na saída de erro e termina com o código 1.

| Variável | Obrigatória | Padrão | Significado |
|---|---|---|---|
| `HTTP_ADDR` | Não | `:8080` | Endereço em que o servidor HTTP escuta, no formato `host:porta` |

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
| `cmd/api/main.go` | `main` e `run`: lê a configuração, sobe o servidor HTTP e trata o sinal de parada |
| `cmd/api/server.go` | O tipo que implementa as operações do contrato, e a montagem do handler |
| `internal/api/` | Código gerado do contrato |
| `internal/platform/config/` | Leitura e validação das variáveis de ambiente |
| `internal/platform/httpx/` | Middleware HTTP: identificador e log de cada requisição |
