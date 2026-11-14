# ADR 0029: Publicação na VPS e decisões da fatia 10

Data: 2026-11-12. Estado: aceito. Este ADR aprova três dependências no app: `@react-native-google-signin/google-signin`, `expo-notifications` e o serviço EAS Build (pelo `npx eas-cli`, sem entrar no `package.json`).

## Contexto

A fatia 10 publica a API, a inferência, o banco, os arquivos e a web, e entrega o app num aparelho real ([roteiro](../roteiro.md)). O roteiro deixou para esta fatia: onde publicar, a biblioteca de push ([ADR 0024](0024-push-no-app.md)) e duas perguntas de [requisitos](../requisitos.md), sobre RN-02 e RN-43.

O responsável pelo produto tem uma VPS: Debian 13, 2 CPU, 7,8 GB de RAM, Docker com Compose e um Caddy no host, nas portas 80 e 443, com um Caddyfile só. A VPS já roda outro sistema, com nomes e portas próprios. Os registros DNS de `api.nupii.com.br`, `app.nupii.com.br` e `media.nupii.com.br` apontam para a VPS.

Fatos do código nesta data:

- O limite de RN-43 usa o endereço da conexão (`backend/internal/platform/httpx/ratelimit.go`, `clientAddress`).
- Só as rotas públicas têm cabeçalhos CORS, e o preflight aceita só `Content-Type` (`backend/cmd/api/server.go`, `allowOtherOrigins` e `answerPreflight`). `OPTIONS /v1/me` responde 404. A área logada da web (issues #232 e #233) chama rotas com token de outra origem, e o navegador bloqueia essas chamadas.
- O tutor é encontrado pelo `firebase_uid` (`owners_firebase_uid_key`). O app não envia o e-mail de verificação, então toda conta com senha tem o e-mail não verificado.
- O app pede a senha de novo antes de trocar a senha e de excluir a conta (`reauthenticate` em `mobile/src/auth/firebase.ts`). Uma conta só com Google não tem senha.

## Decisão

### Onde

1. A API, a inferência, o Postgres e o SeaweedFS rodam na VPS, num compose de produção (`deploy/compose.prod.yaml`), no diretório `/opt/nupii-self`, com o nome de projeto `nupii-self`. O emulador do Authentication não entra.
2. As portas ficam só em `127.0.0.1`: API na 8090, S3 na 8091. Cada serviço tem um limite de memória, medido na issue #151.
3. As imagens são construídas na VPS, a partir do `main` (`git pull` e `docker compose build`). Um script em `deploy/` faz os passos.
4. O Caddy do host recebe três blocos novos e não muda os outros:
   - `api.nupii.com.br`: `reverse_proxy 127.0.0.1:8090`.
   - `media.nupii.com.br`: `reverse_proxy 127.0.0.1:8091`. A API usa esse endereço em `S3_PUBLIC_ENDPOINT`.
   - `app.nupii.com.br`: `file_server` dos arquivos do `expo export --platform web`, com `try_files {path} /index.html`.
   O Caddy faz o HTTPS. A mudança segue esta ordem: cópia do Caddyfile, `caddy validate`, `caddy reload`.
5. Os segredos ficam em `/opt/nupii-self/.env`, com modo 600, fora do git. O arquivo da conta de serviço do Firebase fica em `/opt/nupii-self/secrets/`, montado só para leitura, e a API recebe o caminho em `GOOGLE_APPLICATION_CREDENTIALS`. Um `deploy/.env.prod.example` lista os nomes, sem valores.

### Endereço do cliente (RN-43)

6. A API recebe a variável `TRUSTED_PROXIES`, uma lista de CIDR. Quando o endereço da conexão está na lista, o endereço do cliente é o último valor de `X-Forwarded-For`. Nos outros casos, é o endereço da conexão, como hoje. Sem a variável, nada muda.
7. Por padrão, o Caddy ignora o `X-Forwarded-For` que vem do cliente ([reverse_proxy, "Defaults"](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#defaults)). Em produção, a lista tem só o endereço de onde o Caddy chega ao container, que a issue #151 mede.

### Web com conta

8. As rotas com token aceitam as origens da variável `WEB_ORIGINS`: a resposta e o preflight levam a origem exata, `Vary: Origin` e o cabeçalho `Authorization`. O token vai no cabeçalho, não num cookie, então a resposta não leva `Access-Control-Allow-Credentials`. As rotas públicas continuam com `*` ([ADR 0022](0022-web-publica-no-alvo-web-do-expo.md), item 4, que este item muda para as rotas com token).
9. Em produção, `WEB_ORIGINS` é `https://app.nupii.com.br`. No ambiente local, é o endereço do servidor do Expo.

### Login com Google (RN-02)

10. O projeto do Firebase usa a opção "uma conta por e-mail". A regra de RN-02 fica com o Firebase, e a API continua a achar o tutor pelo `firebase_uid`.
11. Na web, o app usa `signInWithPopup` do SDK do Firebase. No Android, o app pega o ID token do Google com `@react-native-google-signin/google-signin` e entra com `signInWithCredential`.
12. Quando o Firebase responde `auth/account-exists-with-different-credential`, o app pede a senha da conta, entra com ela e liga a credencial do Google com `linkWithCredential` ([Identity Platform, vincular contas](https://cloud.google.com/identity-platform/docs/link-accounts)).
13. Uma conta sem senha confirma a troca de senha e a exclusão da conta com o Google, e não com a senha. A tela de troca de senha não aparece para essa conta.
14. O primeiro login com Google sem tutor na API leva à tela de aceite dos termos, que chama `POST /v1/me`, como no cadastro com senha.

### App no aparelho

15. O APK sai do EAS Build, com distribuição interna. O `eas.json` tem os valores públicos (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL` e a configuração do Firebase).
16. O app registra o dispositivo com o token nativo do FCM (`getDevicePushTokenAsync` do `expo-notifications`), porque a API envia pelo Firebase Admin SDK ([ADR 0024](0024-push-no-app.md)).

### Cópia de segurança

17. Um timer do systemd no host roda `pg_dump -Fc` todo dia às 4h de `America/Sao_Paulo`, depois da limpeza das 3h. O arquivo fica em `/opt/nupii-self/backups`, fora do volume do banco.
18. Um script restaura a cópia mais nova num container temporário e confere a contagem de linhas das tabelas. A issue #155 roda o script e mostra a saída.

## Alternativas

- Imagens no GitHub Container Registry, construídas pelo CI. Tradeoff: a VPS não compila, mas o CI precisa de credenciais de escrita no registro e a VPS de leitura.
- A web chama a API pela mesma origem (`app.nupii.com.br/v1`, pelo Caddy), sem CORS. Tradeoff: nenhuma mudança na API em produção, mas o ambiente local continua bloqueado, porque o servidor do Expo não repassa `/v1`.
- `expo-auth-session` no lugar do pacote do Google. Tradeoff: funciona no Expo Go, mas abre o navegador para o login, e o pacote do Google usa a conta do aparelho.
- O app envia o e-mail de verificação no cadastro. Tradeoff: uma conta verificada mantém a senha quando o Google entra (ver Consequências), mas o cadastro ganha um passo e a fatia ganha uma tela.

## Consequências

- Um e-mail `@gmail.com` cadastrado com senha, sem verificação, perde a senha no primeiro login com Google: o Firebase troca o provedor para evitar a tomada da conta ([Identity Platform, vincular contas](https://cloud.google.com/identity-platform/docs/link-accounts)). A pessoa continua a entrar pelo Google.
- A documentação do Firebase não diz se o `firebase_uid` continua o mesmo nessa troca. Se mudar, a API cria um segundo tutor para o mesmo e-mail. A issue #153 confere isso no projeto real do Firebase, não no emulador, antes do merge.
- A cópia do banco tem dados pessoais que a limpeza diária (RN-42) e a exclusão da conta (RN-84) já apagaram, até a cópia sair da retenção.
- O `pg_dump` não leva os arquivos do SeaweedFS (fotos e anexos).
- Uma única VPS: uma falha do disco perde o banco, as cópias e os arquivos juntos.
- O APK com o pacote do Google não roda no Expo Go. O teste do login com Google no Android usa o APK.

## Verificação

- #151: `TRUSTED_PROXIES` com o endereço medido, e uma chamada pelo Caddy mostra no log o IP do cliente, não o do Caddy.
- #152: as rotas `/found`, `/reports`, `/card` e `/terms` abrem direto pela URL.
- #153: login com Google numa conta nova, numa conta com senha `@gmail.com` e numa conta com senha de outro domínio, com o `firebase_uid` de antes e de depois.
- #154: o APK instalado num aparelho real usa a API publicada e recebe um push.
- #155: a saída do script de restauração.

## Verificação posterior

Data: 2026-11-13. A cópia de segurança (itens 17 e 18) fica no backlog ([issue #155](https://github.com/mcoldibelli/nupii/issues/155)) até a publicação ter usuários reais. O plano dos dois itens continua.

Data: 2026-11-14. A preparação da #151 ajustou dois itens:

- Item 3: a VPS não acessa o GitHub (o repositório é privado, e a VPS não tem o `gh`). O `deploy/publish.sh` envia o código do commit publicado (`git archive`), os pesos do modelo e a chave da conta de serviço pela conexão `ssh`, e a VPS constrói as imagens. O commit publicado é o do `main`.
- Item 5: o `deploy/publish.sh` cria o `/opt/nupii-self/.env` na primeira publicação, com segredos aleatórios gerados na própria VPS (`openssl rand`). Nenhum segredo passa pela máquina de quem publica, além da chave da conta de serviço.
- Item 7: o proxy confiável é o gateway da rede do compose, fixado em `172.31.90.0/24` (`TRUSTED_PROXIES=172.31.90.1/32`). A #151 confere o valor pelo limite de RN-43: 11 POSTs públicos do mesmo endereço recebem 429, e o de outro endereço não.

