# ADR 0008: Autenticação com Firebase Authentication

Data: 2026-11-10. Estado: aceito. Este ADR aprova uma dependência no backend.

## Contexto

O tutor precisa de: conta com e-mail e senha, login com Google, sessão que continua depois de fechar o app, e redefinição de senha por e-mail (RF-01 a RF-07).

Um app mobile não usa cookie de sessão. Implementar a autenticação na API pede: hash de senha, emissão e rotação de tokens, envio de e-mail e o fluxo de login do Google. Autenticação é a parte do sistema em que um erro custa mais.

O sistema já precisa do Firebase para o push (FCM, RF-26).

## Decisão

1. A identidade do tutor fica no Firebase Authentication: e-mail e senha, e login com Google.
2. O app entra pelo SDK do Firebase e envia o ID token em cada chamada, no cabeçalho `Authorization: Bearer`.
3. A API valida o ID token em cada chamada com o Firebase Admin SDK para Go (`firebase.google.com/go/v4`). O mesmo SDK envia o push.
4. A tabela `owners` guarda o `firebase_uid` com restrição de unicidade. A API não guarda senha e não tem tabela de sessão.
5. O tutor é criado na API pelo primeiro acesso depois do cadastro no Firebase, junto com o aceite dos termos.
6. Uma conta excluída ou anonimizada na API recebe 401, mesmo com um ID token ainda válido.
7. Excluir a conta grava a tarefa `delete_identity_user` na mesma transação da anonimização. A tarefa apaga o usuário no Firebase e é repetida até dar certo (fila do [ADR 0003](0003-estado-postgres-fila-no-banco.md)).
8. A web pública não tem login. Ela só chama endpoints públicos.

Dentro do backend, o módulo `identity` depende de uma interface `TokenVerifier`, declarada nele. Os testes de unidade usam uma implementação falsa. O Firebase só aparece em `platform/firebase`.

## O que a API não implementa

| Função | Quem faz |
|---|---|
| Hash e verificação de senha | Firebase |
| Emissão, renovação e rotação de tokens | Firebase (o SDK do app renova o ID token) |
| Esqueci a senha e o e-mail de redefinição | Firebase. A API não precisa de um serviço de envio de e-mail. |
| Login com Google | Firebase, como provedor |
| Limite de tentativas no login | Firebase |

## Alternativas

- JWT e refresh token próprios, com biblioteca de JWT. Tradeoff: nenhum serviço externo no login e nenhum dado de identidade fora do nosso banco, com todo o código da tabela acima por nossa conta.
- Só "Entrar com Google", sem e-mail e senha. Tradeoff: ainda menos telas, mas quem não tem conta Google fica de fora, e a API ainda precisaria de uma sessão.
- Provedor de identidade hospedado por nós (Keycloak). Tradeoff: os dados ficam conosco, com um serviço a mais para operar.

## Consequência

- O e-mail e a senha do tutor ficam no Google. A política de privacidade precisa dizer isso (LGPD, RNF-03).
- O login depende de um serviço externo. Com o Firebase fora do ar, ninguém entra. Quem já tem um ID token válido continua usando o app até o token vencer.
- Trocar de provedor no futuro pede a transferência das contas.
- O ambiente local e os testes de integração precisam do emulador do Firebase Authentication ou de um projeto Firebase de teste.

## Não verificado

Nenhum item desta lista foi conferido na documentação antes do aceite. Cada item é conferido na fatia 1, antes do código.

- A duração do ID token (esperado: 1 hora) e o modo como o Admin SDK valida o token sem chamada de rede por requisição.
- A biblioteca do lado do app no Expo: SDK JavaScript do Firebase ou módulo nativo. A escolha vira um ADR na fatia 1.
- O comportamento do Firebase quando um login com Google usa o e-mail de uma conta que já tem senha. A RN-02 fica em rascunho até essa verificação.
- Os limites e o preço do plano gratuito.
- Se o emulador do Firebase Authentication atende os testes de integração.

Referências: [Firebase Authentication](https://firebase.google.com/docs/auth), [Verificar ID tokens no Admin SDK](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Emulador do Authentication](https://firebase.google.com/docs/emulator-suite/connect_auth).
