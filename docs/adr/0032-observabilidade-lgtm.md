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
7. O Grafana não tem endereço na internet: ele é de uso interno. A porta fica só em `127.0.0.1` (8092), sem bloco no Caddy, e o acesso é por túnel SSH: `ssh -L 3000:127.0.0.1:8092 vps` e `http://localhost:3000` (#293; antes era `https://grafana.nupii.com.br`, com a tela de login aberta para a internet). O login do Grafana fica ligado, sem acesso anônimo e sem cadastro aberto. A senha do administrador fica no `.env` da VPS. Loki, Tempo, Prometheus e Alloy não têm porta fora da rede do compose.

8. As métricas HTTP têm a rota (`http.route`, por exemplo `/v1/pets/{petId}`), que o `RequestLog` põe no labeler do `otelhttp` depois do roteamento (#303). O painel "Nupii API" mostra a latência e os erros por rota, a latência da inferência e as fotos recusadas (422).
9. Os números do negócio e da fila de tarefas vêm do Postgres, por uma fonte "Nupii DB" no Grafana (#303). A migration 00017 cria o schema `metrics`, só com views de contagem (contas, pets, focinhos por versão do vetor, identificações, ocorrências e notificações por dia, tarefas por tipo e estado), sem nome, e-mail, telefone, ponto ou foto. O papel `metrics_reader` lê só esse schema, com no máximo 3 conexões. O `deploy/publish.sh` cria o papel e define a senha (`GRAFANA_DB_PASSWORD` do `.env`, criada na primeira vez) com `deploy/postgres/metrics-reader.sql`.

## Alternativas

- `grafana/otel-lgtm` num container só. Tradeoff: menos configuração, mas o próprio projeto diz que não serve para produção.
- Grafana Cloud. Tradeoff: nenhuma memória da VPS, mas os logs com dados pessoais saem da VPS.
- Mimir no lugar do Prometheus. Tradeoff: o "M" do LGTM e armazenamento em objeto, mas mais memória e configuração para uma instância só.
- Só os logs no Loki, sem SDK na API. Tradeoff: nenhuma dependência nova, mas sem traces e sem métricas de latência.

## Consequências

- Cinco containers a mais na VPS. A issue #241 mede a memória com `docker stats` e fixa os limites.
- Só quem tem acesso SSH à VPS abre o Grafana. O registro DNS de `grafana.nupii.com.br` ficou sem uso.
- O envio dos traces é assíncrono (processador em lote do SDK): a requisição não espera o Alloy. Uma falha do Alloy perde dados de telemetria, não requisições.
- A observabilidade não tem cópia de segurança: 7 e 30 dias de dados podem ser perdidos.
- O Alloy lê os logs pelo socket do Docker da VPS, montado como `:ro`. O `:ro` não limita a API do Docker: quem controla o Alloy controla o Docker do host, que também roda o `nupii-hml`. O Alloy não tem porta fora da rede do compose, e o filtro `com.docker.compose.project=nupii-self` limita os logs lidos ao projeto. A alternativa sem o socket é o driver de log do Docker mandar os logs ao Loki, o que muda a configuração do Docker do host.
- Versões fixadas (#241): Grafana 13.3.1, Loki 3.7.10, Tempo 3.1.1 (modo monolítico, sem Kafka), Prometheus 3.16.0 (receptor OTLP) e Alloy 1.22.0. Memória no teste local, logo após a subida: Grafana 255 MiB, Loki 155 MiB, Tempo 137 MiB, Alloy 93 MiB e Prometheus 90 MiB. Limites: 384, 384, 384, 192 e 256 MiB. A medida na VPS fica para a publicação.

## Verificação

- #241: uma requisição feita pelo Caddy aparece no Grafana como trace (HTTP, Postgres e inferência), com as linhas de log do mesmo `trace_id` no Loki e a métrica de latência no Prometheus.
- #241: `docker stats` na VPS com os limites de memória de cada container.
