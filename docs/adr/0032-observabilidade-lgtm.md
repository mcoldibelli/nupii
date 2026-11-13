# ADR 0032: Observabilidade com Grafana, Loki, Tempo e Prometheus

Data: 2026-11-13. Estado: aceito. Este ADR aprova dependências diretas no backend: `go.opentelemetry.io/otel`, o SDK de traces e de métricas, o exportador OTLP e `go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp`. Os módulos `otel` e `otelhttp` já estão no `go.mod` como indiretos, pelo Firebase.

## Contexto

Em [arquitetura](../arquitetura.md), "Fora da v1", métricas e tracing entram com a primeira publicação com usuários reais. A fatia 10 é essa publicação ([ADR 0029](0029-publicacao-na-vps.md)).

A API escreve logs em JSON com `log/slog`, com um identificador por requisição (RNF-07). A API não tem métricas nem traces.

A VPS tem 2 CPU e 7,8 GB de RAM e também roda outro sistema. A imagem `grafana/otel-lgtm` junta tudo num container, mas o README dela diz que ela serve para "development, demo, and testing environments" ([docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm)). O modo monolítico do Mimir é para "getting started or running Grafana Mimir in a development environment" ([Mimir, deployment modes](https://grafana.com/docs/mimir/latest/references/architecture/deployment-modes/)).

## Decisão

1. A observabilidade roda na VPS, no compose de produção (`nupii-self`), com um container por componente, cada um com versão fixa e limite de memória:
   - Grafana, para ver os dados.
   - Loki, para os logs.
   - Tempo, para os traces.
   - Prometheus, para as métricas, no lugar do Mimir: um nó só não precisa do armazenamento distribuído do Mimir.
   - Grafana Alloy, o coletor.
2. O Alloy lê os logs dos containers do projeto `nupii-self` e manda para o Loki. Ele recebe OTLP da API e manda os traces para o Tempo e as métricas para o Prometheus.
3. A API exporta traces e métricas por OTLP para o Alloy quando `OTEL_EXPORTER_OTLP_ENDPOINT` existe. Sem a variável, a API não exporta nada: o ambiente local, o CI e os testes não mudam.
4. A API instrumenta:
   - as requisições HTTP, com `otelhttp`;
   - as chamadas ao serviço de inferência, com o transporte do `otelhttp`;
   - as consultas ao Postgres, com o `QueryTracer` do pgx, escrito em `platform/postgres`, sem dependência nova;
   - cada linha de log com o `trace_id` da requisição, para ligar o log ao trace no Grafana.
5. O serviço de inferência entra só com os logs. O trace da chamada sai da API.
6. Retenção: 7 dias para logs e traces, 30 dias para métricas. Os logs podem ter dados pessoais, e 7 dias fica dentro do prazo de 30 dias de RN-42.
7. O Grafana abre em `https://grafana.nupii.com.br`, por um bloco novo no Caddy do host, com a porta só em `127.0.0.1` (8092). O login do Grafana fica ligado, sem acesso anônimo e sem cadastro aberto. A senha do administrador fica no `.env` da VPS. Loki, Tempo, Prometheus e Alloy não têm porta fora da rede do compose.

## Alternativas

- `grafana/otel-lgtm` num container só. Tradeoff: menos configuração, mas o próprio projeto diz que não serve para produção.
- Grafana Cloud. Tradeoff: nenhuma memória da VPS, mas os logs com dados pessoais saem da VPS.
- Mimir no lugar do Prometheus. Tradeoff: o "M" do LGTM e armazenamento em objeto, mas mais memória e configuração para uma instância só.
- Só os logs no Loki, sem SDK na API. Tradeoff: nenhuma dependência nova, mas sem traces e sem métricas de latência.

## Consequências

- Cinco containers a mais na VPS. A issue #241 mede a memória com `docker stats` e fixa os limites.
- O registro DNS de `grafana.nupii.com.br` é criado pelo responsável pelo produto.
- O envio dos traces é assíncrono (processador em lote do SDK): a requisição não espera o Alloy. Uma falha do Alloy perde dados de telemetria, não requisições.
- A observabilidade não tem cópia de segurança: 7 e 30 dias de dados podem ser perdidos.

## Verificação

- #241: uma requisição feita pelo Caddy aparece no Grafana como trace (HTTP, Postgres e inferência), com as linhas de log do mesmo `trace_id` no Loki e a métrica de latência no Prometheus.
- #241: `docker stats` na VPS com os limites de memória de cada container.
