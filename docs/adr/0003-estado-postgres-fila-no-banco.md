# ADR 0003: Postgres como único estado, sem Redis, fila de tarefas no banco

Data: 2026-11-10. Estado: aceito.

## Contexto

- Um alerta de desaparecimento não pode se perder quando o processo para (RNF-01). Para isso, a ocorrência e a tarefa do alerta precisam ser gravadas juntas.
- O envio de push, o recálculo de vetores e a exclusão do usuário no provedor de identidade dependem de serviços externos. Eles precisam de nova tentativa quando o serviço falha (RNF-02).
- A busca geográfica (RN-32) e a busca por vetor (RN-10) precisam de PostGIS e pgvector. As duas são extensões do Postgres.
- A v1 roda em uma instância da API.

## Decisão

1. O estado do sistema fica em dois lugares: Postgres (com PostGIS e pgvector) e um armazenamento de objetos compatível com S3 para fotos e anexos (MinIO no ambiente local).
2. Não há Redis.
3. As tarefas em segundo plano ficam em uma tabela `jobs`. A tarefa é gravada na mesma transação do dado que a causa. Workers no mesmo binário leem a tabela com `SELECT ... FOR UPDATE SKIP LOCKED`.
4. A fila é escrita no projeto, sem biblioteca. Tamanho esperado: uma tabela e cerca de 100 linhas de Go.

Regras da fila:

- Quem fecha: o worker para quando o contexto raiz é cancelado, depois de terminar a tarefa em curso.
- Falha: a tarefa volta com espera crescente. Depois do limite de tentativas, fica com estado de falha e aparece no log.
- Consumidor lento: as tarefas esperam na tabela. Nada se perde, o atraso cresce.
- Toda tarefa precisa ser segura para executar duas vezes.

## Usos de Redis avaliados

| Uso | Precisa de Redis? | Motivo |
|---|---|---|
| Busca geográfica | Não | O PostGIS já responde, e as coordenadas ficam em um lugar só. |
| Fila de tarefas | Não | Com Redis, gravar o dado e criar a tarefa deixam de ser uma transação. Isso quebra o RNF-01. |
| Sessões | Não | As sessões ficam no Firebase Authentication ([ADR 0008](0008-autenticacao-firebase.md)). |
| Cache de leitura | Não, hoje | Nenhuma consulta lenta foi medida. Cache sem medida é custo sem ganho conhecido. |
| Limite de tentativas por IP | Só com duas instâncias | Com uma instância, um mapa em memória faz o mesmo. |
| Aviso em tempo real entre instâncias (pub/sub) | Só com duas instâncias e tela ao vivo | Os requisitos não têm tela ao vivo. O aviso chega por push. |

Gatilho para Redis entrar: a API passar a rodar em mais de uma instância.

## Alternativas

- Biblioteca de fila sobre Postgres (River). Tradeoff: nova tentativa, agenda e painel prontos, com uma dependência a mais. O volume é baixo e a fila precisa de poucas funções. Se a fila própria passar de 300 linhas, trocar pela biblioteca.
- Broker (Kafka, NATS, RabbitMQ). Tradeoff: entrega para vários consumidores, com um serviço a mais. Com broker, gravar o dado e publicar o evento deixam de ser uma transação, e o padrão outbox passa a ser necessário.
- Fila em memória. Rejeitada: a tarefa se perde quando o processo para, o que quebra o RNF-01.

## Consequência

- Um alerta não se perde quando o processo para.
- O limite da fila é o do Postgres. A vazão desta forma não foi medida. O uso esperado é baixo: uma tarefa por desaparecimento e uma por push.
- O limite de tentativas por IP (RN-43) fica em memória, válido para uma instância. Com duas instâncias, essa decisão precisa de revisão.

Referência: [PostgreSQL, SELECT, cláusula de bloqueio e SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE).
