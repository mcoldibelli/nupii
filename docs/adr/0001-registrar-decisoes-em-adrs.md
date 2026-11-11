# ADR 0001: Registrar decisões de arquitetura em ADRs

Data: 2026-11-10. Estado: aceito.

## Contexto

O sistema tem três projetos (API, app e inferência) e decisões que valem por muito tempo: linguagem, banco, contrato da API, autenticação. O motivo de uma decisão se perde quando ele fica só no código ou em uma conversa. Sem o motivo, a decisão é desfeita ou repetida sem critério.

## Decisão

1. Toda decisão que não é trivial vira um ADR antes do código.
2. Um ADR é um arquivo em `docs/adr/`, com o nome `NNNN-titulo-curto.md`. O número é sequencial e não é usado de novo.
3. Um ADR tem estas seções: Contexto, Decisão, Alternativas (cada uma com o tradeoff), Consequência. Quando existe, ele tem também: Não verificado, Referências.
4. O contexto justifica a decisão por requisito ou por restrição do produto, com o identificador do requisito quando ele existe.
5. Um ADR tem o estado `proposto` ou `aceito`. Um ADR aceito não é editado. Uma decisão nova cria um ADR novo, que diz qual ADR ele substitui.
6. Nenhuma dependência entra no sistema sem estar em um ADR aceito.
7. O README da raiz tem o índice dos ADRs, com o estado de cada um.

## Alternativas

- Sem registro: a decisão fica no código e nas mensagens de commit. Tradeoff: nenhum documento para manter, mas as alternativas rejeitadas e os motivos não ficam em lugar nenhum.
- Um documento único de decisões. Tradeoff: um arquivo só para abrir, mas o histórico de uma decisão se mistura com o das outras, e substituir uma decisão pede editar texto já aceito.
- Wiki fora do repositório. Tradeoff: edição mais fácil, mas a decisão fica longe do código e fora da revisão do PR.

## Consequência

- Cada decisão custa um arquivo e uma linha no índice.
- Uma dependência nova pede um ADR antes do primeiro `import`.
- O que um ADR deixou sem verificar fica visível na seção "Não verificado" e vira o primeiro passo da fatia que depende dele.

Referência: [Architectural Decision Records](https://adr.github.io/).
