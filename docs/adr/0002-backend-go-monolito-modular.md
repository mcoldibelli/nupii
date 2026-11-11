# ADR 0002: Backend em Go, monólito modular

Data: 2026-11-10. Estado: aceito.

## Contexto

Os requisitos descrevem seis domínios: identidade, pets, biometria, ocorrências, alertas e saúde. Eles pedem tarefas em segundo plano (alerta de proximidade, push, recálculo de vetores) e uma tarefa agendada (limpeza diária). Nenhum requisito pede escala independente por domínio.

As consultas centrais cruzam domínios. Exemplo: o focinho mais parecido, de um pet não excluído, de uma conta ativa (RN-10, RN-11).

Restrições: a v1 roda em uma instância, a publicação precisa ser simples (um artefato) e cada dependência precisa de um ADR ([ADR 0001](0001-registrar-decisoes-em-adrs.md)). Go atende essas restrições: ele gera um binário único, e a biblioteca padrão tem servidor HTTP com rotas, log estruturado e concorrência para os workers.

## Decisão

Um binário Go. Um pacote por domínio em `backend/internal/`: `identity`, `pets`, `biometrics`, `reports`, `alerts`, `health`. A infraestrutura fica em `platform`.

As regras entre módulos estão em [arquitetura.md](../arquitetura.md), seção "Módulos do backend".

HTTP com a biblioteca padrão (`net/http`, com método e padrão na rota, disponível desde o Go 1.22). Log com `log/slog`. Nenhum framework web.

## Alternativas

- Orientado a eventos com broker (Kafka ou NATS). Tradeoff: entrega o mesmo evento a vários consumidores, mas adiciona um serviço para operar, e nenhum requisito pede um segundo consumidor. A fila no Postgres ([ADR 0003](0003-estado-postgres-fila-no-banco.md)) atende o RNF-01.
- Microsserviços com um banco por serviço. Tradeoff: isolamento maior, com o maior custo de construção. As consultas que cruzam domínios (focinho mais parecido de pet ativo de conta ativa) virariam chamadas de rede.
- Framework web (Gin, Echo, Chi). Tradeoff: menos código de rota, mais uma dependência. A biblioteca padrão já faz rota com método e parâmetro.

## Consequência

- Uma função nova toca um pacote.
- Os limites entre módulos são convenção e revisão, não rede. Um `JOIN` entre módulos precisa estar listado na arquitetura.
- Para separar um módulo em serviço no futuro, será preciso desfazer esses `JOIN`s.

Referências: [Go 1.22, roteamento em net/http](https://go.dev/blog/routing-enhancements), [log/slog](https://pkg.go.dev/log/slog).
