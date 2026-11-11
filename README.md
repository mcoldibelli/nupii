# Nupii

Plataforma para tutores de pets, com três partes: saúde do pet, mural de perdidos e achados, e identificação de cães pela foto do focinho.

## Estado

Fase de plano. As decisões de arquitetura estão aceitas. Ainda não existe código. O próximo passo é a fatia 0 do [roteiro](docs/roteiro.md).

## Como executar

Ainda não há o que executar. A fatia 0 entrega o `docker compose` e o conteúdo desta seção.

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
| [0003](docs/adr/0003-estado-postgres-fila-no-banco.md) | Postgres como único estado, sem Redis, fila de tarefas no banco | aceito |
| [0004](docs/adr/0004-acesso-a-dados.md) | pgx e sqlc para consultas, goose para migrations | aceito |
| [0005](docs/adr/0005-contrato-openapi.md) | Contrato da API em OpenAPI, escrito antes do código | aceito |
| [0006](docs/adr/0006-mobile-expo-web-publica.md) | App em React Native com Expo, web pública mínima | aceito (a forma da web: decisão na fatia 4) |
| [0007](docs/adr/0007-inferencia-python-onnx.md) | Inferência em serviço Python separado, sem torch | aceito |
| [0008](docs/adr/0008-autenticacao-firebase.md) | Autenticação com Firebase Authentication | aceito |
| [0009](docs/adr/0009-idioma.md) | Código em inglês, documentação em português | aceito |
| [0011](docs/adr/0011-runtime-do-oapi-codegen.md) | Biblioteca de runtime do código gerado pelo oapi-codegen | proposto |

## Regras do projeto

- Toda decisão que não é trivial vira um ADR antes do código.
- Nenhuma dependência entra sem estar em um ADR aceito.
- Toda tarefa em trabalho é uma issue no GitHub, criada antes de o trabalho começar.
- Cada issue tem um branch próprio, que entra em `develop` por PR. Nenhuma mudança entra direto em `main`.
- Toda fatia do roteiro termina com teste executado e documento atualizado.
- Uma decisão ou uma implementação que muda o que um documento diz atualiza esse documento na mesma mudança.
