#!/usr/bin/env bash
# Publishes Nupii on the VPS (ADR 0029): the code of HEAD, the weights of the
# model, the key of the Firebase service account and the web. The VPS builds
# the images; it needs no access to GitHub. Run from a clean checkout.
#   ./deploy/publish.sh            (the host is "vps" of ~/.ssh/config)
#   NUPII_VPS=other ./deploy/publish.sh
set -euo pipefail

host=${NUPII_VPS:-vps}
dir=/opt/nupii-self
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail() {
  echo "Erro: $*" >&2
  exit 1
}

[[ -z $(git status --porcelain) ]] || fail "há mudanças sem commit. Publique só código que está no git."
ls inference/models/*.onnx >/dev/null 2>&1 || fail "faltam os pesos do modelo. Execute ./inference/download_weights.sh"
# shellcheck disable=SC1091
. backend/.env
[[ -f ${GOOGLE_APPLICATION_CREDENTIALS:-} ]] || fail "backend/.env não aponta para a chave da conta de serviço. Execute ./deploy/firebase-setup.sh"

echo "1/5 código de $(git rev-parse --short HEAD)"
ssh "$host" "mkdir -p $dir/models $dir/web && install -d -m 700 $dir/secrets"
git archive --format=tar HEAD | ssh "$host" "rm -rf $dir/src.new && mkdir $dir/src.new && tar -x -C $dir/src.new && rm -rf $dir/src && mv $dir/src.new $dir/src"

echo "2/5 pesos do modelo e chave do Firebase"
scp -q inference/models/*.onnx "$host:$dir/models/"
scp -q "$GOOGLE_APPLICATION_CREDENTIALS" "$host:$dir/secrets/firebase.json"
# The API runs as the user 65534: the file is readable, the folder is root only.
ssh "$host" "chmod 444 $dir/secrets/firebase.json"

echo "3/5 .env (criado só na primeira vez, com segredos aleatórios)"
ssh "$host" "test -f $dir/.env || (umask 077 && printf '%s\n' \
  POSTGRES_USER=nupii POSTGRES_DB=nupii \"POSTGRES_PASSWORD=\$(openssl rand -hex 24)\" \
  S3_BUCKET=nupii \"S3_ACCESS_KEY_ID=\$(openssl rand -hex 12)\" \"S3_SECRET_ACCESS_KEY=\$(openssl rand -hex 24)\" \
  FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID > $dir/.env)"
# A value that a later version needs is added to an old .env; the others stay.
ssh "$host" "grep -q '^GRAFANA_ADMIN_PASSWORD=' $dir/.env || echo \"GRAFANA_ADMIN_PASSWORD=\$(openssl rand -hex 24)\" >> $dir/.env"
ssh "$host" "grep -q '^GRAFANA_DB_PASSWORD=' $dir/.env || echo \"GRAFANA_DB_PASSWORD=\$(openssl rand -hex 24)\" >> $dir/.env"

echo "4/5 web"
out=$(mktemp -d)
(
  cd mobile
  EXPO_PUBLIC_API_URL=https://api.nupii.com.br EXPO_PUBLIC_WEB_URL=https://app.nupii.com.br \
    EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL= npx expo export --platform web --output-dir "$out" >/dev/null
)
# The web of production never points to the addresses of the local
# environment or to the emulator. A bare "localhost" is fine: the Firebase SDK
# and the router of Expo have it as a default value.
! grep -rqE 'localhost:(8080|8081|8099|9099)|10\.0\.2\.2|demo-nupii' "$out" --include='*.js' --include='*.html' ||
  fail "o pacote da web tem um endereço local ou o projeto do emulador. Confira o mobile/.env."
# Caddy reads the files as its own user: no owner or mode of this machine.
# No metadata of macOS (the ._ files and the extended attributes).
COPYFILE_DISABLE=1 tar --no-xattrs -C "$out" -c . | ssh "$host" "rm -rf $dir/web.new && mkdir $dir/web.new && tar -x --no-same-owner -C $dir/web.new && chmod -R a+rX $dir/web.new && rm -rf $dir/web && mv $dir/web.new $dir/web"
rm -rf "$out"

echo "5/5 serviços"
ssh "$host" "cd $dir/src && docker compose -f deploy/compose.prod.yaml --env-file $dir/.env up -d --build --wait"
ssh "$host" "curl -fsS http://127.0.0.1:8090/v1/health" && echo
# The role of Grafana reads only the views of the schema metrics (#303). The
# API applied the migrations when it started, so the views exist.
ssh "$host" "cd $dir && set -a && . ./.env && set +a && docker exec -i nupii-self-db-1 psql -q -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -v pw=\"\$GRAFANA_DB_PASSWORD\" -v db=\"\$POSTGRES_DB\" -f - < src/deploy/postgres/metrics-reader.sql"
echo "Publicado. Pelo Caddy: https://api.nupii.com.br e https://app.nupii.com.br"
