# ADR 0014: Emulador do Firebase Authentication no ambiente local e no CI

Data: 2026-11-10. Estado: aceito. Este ADR aprova uma ferramenta para o ambiente local e para o CI: `firebase-tools`.

## Contexto

O [ADR 0008](0008-autenticacao-firebase.md) pôs a identidade no Firebase Authentication. Ele registrou que o ambiente local e os testes de integração precisam do emulador ou de um projeto de teste, e deixou sem verificar se o emulador atende.

Os testes não podem depender da rede nem mudar um projeto real. Nenhuma credencial pode ficar no repositório.

## Medida

O emulador do Authentication do `firebase-tools` 15.35.0 foi executado em um container (`node:24-slim`, linux/arm64), com o projeto `demo-nupii`.

| Teste | Resultado |
|---|---|
| Subida do emulador | Pronto em 5 segundos, sem Java. Memória: 322 MiB |
| Criar conta e entrar pela API REST do emulador | Devolve um ID token com validade de 3.600 segundos e o e-mail nos dados do token |
| Firebase Admin SDK para Go, com `FIREBASE_AUTH_EMULATOR_HOST` | Aceita o token do emulador em menos de 10 ms |
| Texto que não é um token | Recusado |
| Token de outro projeto | Recusado, com erro de `aud` |
| Admin SDK sem `FIREBASE_AUTH_EMULATOR_HOST` e sem credencial | O cliente de autenticação não é criado: o SDK pede uma credencial |

O token do emulador não tem assinatura (`alg: none`).

## Decisão

1. O ambiente local e o CI usam o emulador do Authentication do `firebase-tools`, em uma versão fixa, em um container do compose. O projeto do emulador é `demo-nupii`.
2. A API do ambiente local recebe a variável `FIREBASE_AUTH_EMULATOR_HOST`. O Firebase Admin SDK lê essa variável e passa a usar o emulador.
3. A API escreve um aviso no log da subida quando essa variável está definida, porque nesse modo o token não tem a assinatura conferida. A variável nunca é definida na produção.

## Alternativas

- Um projeto real do Firebase só para testes. Tradeoff: o comportamento é o do serviço real, mas os testes passam a depender da rede, de uma credencial no CI e de dados compartilhados entre execuções.
- Só a implementação falsa do `TokenVerifier`, sem emulador. Tradeoff: nenhuma ferramenta, mas o app não consegue entrar no ambiente local, e a integração com o Admin SDK fica sem teste.

## Consequência

- O compose tem mais um serviço, com uma imagem do Node e o `firebase-tools`.
- As contas do emulador ficam na memória e somem quando o container reinicia. A tabela `owners` do banco continua com os tutores antigos. No ambiente local, `down -v` apaga os dois juntos.
- Um token do emulador não serve em um projeto real, e um token real não serve no emulador.

## Não verificado

- O emulador em linux/amd64. O workflow `integration` faz essa verificação.
- A diferença de comportamento entre o emulador e o serviço real em casos de erro (conta desativada, token revogado). A fatia 9 trata a exclusão de conta.

Referências: [Firebase, emulador do Authentication](https://firebase.google.com/docs/emulator-suite/connect_auth), [Firebase, verificar ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens).
