# ADR 0027: Link da carteirinha

Data: 2026-11-11. Estado: aceito. Este ADR aprova uma dependência no app: `qrcode-generator`.

## Contexto

RF-30 pede um link público da carteirinha do pet, com QR code, que o tutor revoga. RF-31 pede que qualquer pessoa com o link veja a carteirinha. RN-39 pede um token de 256 bits, com só o SHA-256 no banco. A validade do link (RN-40) estava em aberto.

O registro de requisições da API grava o caminho de cada chamada (`internal/platform/httpx/requestlog.go`). Um token no caminho fica no log. A web pública e o app usam o mesmo código ([ADR 0022](0022-web-publica-no-alvo-web-do-expo.md)).

O app é executado no Expo Go. O pacote `react-native-svg` não está instalado.

## Decisão

1. O link vale 30 dias. O tutor revoga o link a qualquer hora e cria outro quando precisa. Um valor só, sem escolha do tutor: RF-30 não pede a escolha.
2. O endereço do link é `<web>/card#token=<token>`. O token fica no fragmento: o navegador não envia o fragmento a um servidor. A página envia o token no corpo de `POST /v1/share-links/opening`. É o mesmo padrão do código do achado (RN-69) e da remoção do token de push (`POST /v1/me/devices/removal`).
3. A abertura é um `POST` público. Ela tem o limite de RN-43, e o limite também atrasa quem tenta adivinhar um token.
4. Os links ficam no módulo `health`, na tabela `share_links`. A carteirinha lê o pet com um `JOIN` em `pets`. O grafo de módulos não muda.
5. A abertura confere o token e conta a abertura num só comando `UPDATE`. Um token desconhecido, revogado, vencido ou de um pet excluído recebe a mesma resposta 404 (RN-41).
6. A carteirinha não mostra dados do tutor (RN-83). Quem recebe o link precisa da saúde do pet, não do contato do tutor.
7. O app desenha o QR code com o `qrcode-generator` (licença MIT, sem dependências). O pacote dá a matriz do código, e o app desenha cada linha com componentes `View`. Só `mobile/src/cards/qr.ts` importa o pacote.
8. O app recebe o endereço da web pública na variável `EXPO_PUBLIC_WEB_URL`.

## Alternativas

- Token no caminho (`GET /v1/share-links/{token}`). Tradeoff: uma chamada `GET` simples, mas o token fica no log da API e no log do servidor da web.
- Validade escolhida pelo tutor (1, 7 ou 30 dias). Tradeoff: menos tempo de exposição para um uso curto, com um campo a mais no formulário. A revogação já fecha o link a qualquer hora.
- `react-native-qrcode-svg`. Tradeoff: um componente pronto, mas com duas dependências (`react-native-svg` e o pacote).

## Consequências

- Um link de 30 dias esquecido continua aberto até vencer. O app mostra os links ativos com as aberturas, para o tutor revogar.
- A contagem de aberturas conta cada carga da página, não cada pessoa.

## Verificação posterior

Data: 2026-11-12. O canvas de design (Carteirinha-Mobile-Compartilhar) pede a escolha da validade e a opção de incluir os exames. A alternativa "validade escolhida pelo tutor" foi adotada: o link vale 1, 7 ou 30 dias, e 30 dias continua o padrão sem escolha (RN-40). A opção "incluir exames" fica no link (coluna `include_exams`, migration 00016) e mostra os exames sem os anexos (RN-83).
