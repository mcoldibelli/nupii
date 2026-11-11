# ADR 0028: Exclusão da conta e limpeza diária

Data: 2026-11-11. Estado: aceito.

## Contexto

RF-08 pede que o tutor exclua a própria conta. RN-03 e RN-04 estavam em rascunho. RF-32 e RN-42 pedem uma limpeza diária dos dados pessoais com mais de 30 dias. A fatia 9 tinha quatro perguntas em aberto: os dados do perfil, a troca do e-mail no provedor, o aceite de uma versão nova dos termos e o fuso das 3h.

Os dados de um tutor ficam em tabelas de seis módulos. Um módulo escreve só nas próprias tabelas, e `identity` não depende de nenhum módulo de domínio ([arquitetura](../arquitetura.md)). O Firebase Authentication guarda o e-mail e a senha ([ADR 0008](0008-autenticacao-firebase.md)).

## Decisão

1. O perfil é o nome (RN-45). O app mostra o e-mail, mas não muda o e-mail. A API guarda o e-mail do registro.
2. O app troca a senha e envia o e-mail de redefinição pelo SDK do Firebase. A API não participa.
3. `DELETE /v1/me` exclui a conta numa transação só:
   - A transação trava a linha do tutor primeiro.
   - `identity` declara a interface `Eraser`. Cada módulo a implementa e apaga ou anonimiza os próprios dados na transação que recebe (RN-84). `cmd/api` passa a lista para `identity`.
   - O tutor fica com o nome "Conta excluída", um e-mail sem dono e a data da exclusão.
   - A transação grava a tarefa `delete_identity_user`, que apaga o usuário no Firebase. Um usuário que não existe mais conta como sucesso.
   - Os arquivos saem do armazenamento depois do commit, com as chaves que a transação devolve.
4. O middleware de autenticação confere a data da exclusão do tutor. Uma conta excluída recebe 401 em toda rota com token, também em `POST /v1/me` (RN-04).
5. Os cadastros biométricos de uma conta excluída são apagados, junto com as fotos e os candidatos de identificação que apontam para eles. Um vetor zerado no índice HNSW não é necessário.
6. A tarefa `purge_expired_data` roda às 3h no fuso `America/Sao_Paulo`. O binário leva a base de fusos (`time/tzdata`). A tarefa grava a próxima execução. Um índice único em `(kind, run_at)` impede uma segunda execução no mesmo horário quando a API sobe de novo.
7. Uma versão nova dos termos de uso fica fora da v1. Ela entra com a primeira mudança do texto ([issue #56](https://github.com/mcoldibelli/nupii/issues/56)).

## Alternativas

- Uma função de `cmd/api` que apaga os dados de todos os módulos. Tradeoff: menos interfaces, mas o código de `cmd/api` escreve nas tabelas dos módulos.
- Zerar o vetor e marcar o cadastro como inválido. Tradeoff: o histórico de candidatos fica, mas um vetor zerado não tem cosseno, e cada consulta precisa de mais um filtro.
- Conferir no servidor que o login é recente antes da exclusão. Tradeoff: protege uma sessão esquecida aberta, mas RF-08 não pede, e o login com Google (fatia 10) precisa do mesmo fluxo. O app pede a senha de novo antes da exclusão.

## Consequências

- Toda requisição com token faz uma leitura da linha do tutor.
- Entre o commit e a tarefa, o usuário ainda existe no Firebase, mas a API recusa o token.
- Um módulo novo com dados do tutor implementa `Eraser`. Sem isso, o dado fica depois da exclusão.
