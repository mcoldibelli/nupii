# Backend

API do Nupii em Go. A arquitetura está em [docs/arquitetura.md](../docs/arquitetura.md).

## Como testar

No diretório `backend`:

```bash
go test ./...
```

## Código gerado do contrato

O arquivo `internal/api/api.gen.go` é gerado a partir de [api/openapi.yaml](../api/openapi.yaml). Ele não é editado à mão.

Depois de mudar o contrato, no diretório `backend`:

```bash
go generate ./...
go test ./...
```

A primeira execução baixa o `oapi-codegen` na versão fixada em `internal/api/generate.go`.
