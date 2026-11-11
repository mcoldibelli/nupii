# ADR 0009: Código em inglês, documentação em português

Data: 2026-11-10. Estado: aceito.

## Contexto

O domínio é descrito em português: tutor, focinho, carteirinha, LGPD. As linguagens, as bibliotecas e as convenções de Go e de TypeScript usam inglês. Sem uma regra, os dois idiomas se misturam dentro do mesmo identificador (`getOcorrenciaById`) e o mesmo conceito recebe dois nomes.

## Decisão

- Em inglês: identificadores, tabelas, colunas, rotas da API, códigos de erro, mensagens de log, mensagens de commit, títulos de PR.
- Em português: documentação, ADRs, issues, comentários que explicam regra de negócio, textos das telas.
- O glossário de [arquitetura.md](../arquitetura.md) liga cada termo do domínio ao nome usado no código. Um termo novo entra no glossário antes de entrar no código.

## Alternativas

- Tudo em inglês. Tradeoff: melhor para leitores de fora do Brasil, mas as regras vêm de um domínio descrito em português (LGPD, tutor, carteirinha).
- Domínio em português no código. Tradeoff: nenhum glossário para manter, mas mistura idiomas dentro do mesmo identificador (`getOcorrenciaById`).

## Consequência

- O glossário precisa ser mantido.
- O mesmo conceito tem um nome só em cada idioma. "Tutor" é sempre `owner` no código.
