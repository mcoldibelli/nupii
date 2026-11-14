#!/usr/bin/env bash
# Starts and stops the local environment of Nupii. Run ./dev.sh with no
# argument to see the commands.
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
cd "$root"

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose=(docker-compose)
else
  echo "Docker Compose não encontrado. Instale o Docker Desktop." >&2
  exit 1
fi

fail() {
  echo "Erro: $*" >&2
  exit 1
}

# The value of a variable of a .env file, without the quotes around it.
env_value() {
  local value
  value=$(grep -E "^$2=" "$1" | tail -1 | cut -d= -f2- || true)
  value=${value#[\"\']}
  echo "${value%[\"\']}"
}

# Each variable of the .env file that the command needs, filled.
check_env() {
  local file=$1
  shift
  [[ -f $file ]] || fail "$file não existe. Copie $file.example para $file e preencha os valores."
  local name
  for name in "$@"; do
    [[ -n $(env_value "$file" "$name") ]] || fail "$file: preencha $name."
  done
}

# The API of the compose uses port 8080. Another program there (for example
# a "go run" of the API) gets part of the requests. The forward of the
# container itself is fine; its process name changes with the Docker runtime
# (com.docker, vpnkit, or ssh with Colima), so the check asks Docker.
check_port() {
  if [[ -n $(docker ps -q --filter "name=^nupii-local-api-1$" --filter status=running) ]]; then
    return
  fi
  local other
  # lsof ends with 1 when no program uses the port; that is the good case.
  other=$( (lsof -nP -iTCP:8080 -sTCP:LISTEN 2>/dev/null || true) | awk 'NR > 1 {print $1 " (PID " $2 ")"}' | head -1)
  [[ -z $other ]] || fail "a porta 8080 está em uso por $other. Pare esse programa (por exemplo, o go run da API) e execute de novo."
}

check_common() {
  check_port
  check_env deploy/.env POSTGRES_USER POSTGRES_DB POSTGRES_PASSWORD \
    S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY
  ls inference/models/*.onnx >/dev/null 2>&1 ||
    fail "faltam os pesos do modelo. Execute ./inference/download_weights.sh"
  check_env mobile/.env EXPO_PUBLIC_API_URL EXPO_PUBLIC_FIREBASE_PROJECT_ID EXPO_PUBLIC_FIREBASE_API_KEY
}

# The Firebase mode of the API that is running: emulador or firebase.
api_mode() {
  local id
  id=$(docker ps -q --filter "name=^nupii-local-api-1$" --filter status=running)
  [[ -n $id ]] || fail "a API não está rodando. Suba antes: ./dev.sh firebase (sua conta real) ou ./dev.sh emulador (contas de teste)."
  if docker inspect "$id" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^FIREBASE_AUTH_EMULATOR_HOST=.'; then
    echo emulador
  else
    echo firebase
  fi
}

# The app and the web take the Firebase mode of the API that is running, so
# the two never differ (#261). $1 is this machine as the app sees it: 10.0.2.2
# in the Android emulator, localhost in the browser. Run it in mobile/.
use_api_mode() {
  local mode
  mode=$(api_mode)
  if [[ $mode == emulador ]]; then
    export EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-nupii EXPO_PUBLIC_FIREBASE_API_KEY=local-emulator \
      EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL="http://$1:9099"
  else
    [[ $(env_value .env EXPO_PUBLIC_FIREBASE_PROJECT_ID) != demo-* ]] ||
      fail "a API usa o projeto real, e mobile/.env não tem a configuração dele. Execute ./deploy/firebase-setup.sh"
    export EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL=
  fi
  echo "Firebase: modo $mode, o mesmo da API."
  # The variables go into the bundle, so a new mode needs a new bundle.
  if [[ $(cat .expo/nupii-firebase-mode 2>/dev/null || true) != "$mode" ]]; then
    mkdir -p .expo
    echo "$mode" >.expo/nupii-firebase-mode
    expo_flags+=(--clear)
  fi
}

up_emulator() {
  check_common
  "${compose[@]}" -f deploy/compose.yaml up -d --build --wait
  done_message emulador
}

up_firebase() {
  check_common
  check_env backend/.env FIREBASE_PROJECT_ID GOOGLE_APPLICATION_CREDENTIALS
  set -a
  # shellcheck disable=SC1091
  . backend/.env
  set +a
  [[ -f $GOOGLE_APPLICATION_CREDENTIALS ]] ||
    fail "a chave da conta de serviço não existe em $GOOGLE_APPLICATION_CREDENTIALS. Execute ./deploy/firebase-setup.sh"
  "${compose[@]}" -f deploy/compose.yaml -f deploy/compose.firebase.yaml up -d --build --wait
  done_message firebase
}

done_message() {
  echo
  echo "Ambiente no modo $1. API: http://localhost:8080/v1/health"
  echo "Agora, em outro terminal: ./dev.sh app (Android) ou ./dev.sh web (navegador)."
  echo "Os dois usam o modo $1 sozinhos."
}

# The Android emulator (if no device is connected) and the Expo server.
app() {
  cd mobile
  expo_flags=()
  use_api_mode 10.0.2.2
  local sdk=${ANDROID_HOME:-$HOME/Library/Android/sdk}
  export PATH="$PATH:$sdk/emulator:$sdk/platform-tools"
  if ! adb devices | grep -q 'device$'; then
    local avd=${AVD:-$(emulator -list-avds | head -1)}
    [[ -n $avd ]] || fail "nenhum emulador Android criado. Crie um no Android Studio (Device Manager)."
    echo "Abrindo o emulador $avd..."
    emulator -avd "$avd" >/dev/null 2>&1 &
    adb wait-for-device
  fi
  [[ -d node_modules ]] || npm install
  # Without CI=1: CI=1 turns off the file watching of Metro.
  unset CI
  exec npx expo start --port "${EXPO_PORT:-8099}" --android ${expo_flags[@]+"${expo_flags[@]}"}
}

# The web (public pages and the area with an account) in the browser of this
# machine, at localhost:8081: the address of the links that the app makes.
# The browser reaches the API and the Authentication emulator at localhost,
# not at the address of the Android emulator (10.0.2.2).
web() {
  cd mobile
  expo_flags=()
  use_api_mode localhost
  [[ -d node_modules ]] || npm install
  unset CI
  export EXPO_PUBLIC_API_URL=http://localhost:8080 EXPO_PUBLIC_WEB_URL=http://localhost:8081
  exec npx expo start --web --port 8081 ${expo_flags[@]+"${expo_flags[@]}"}
}

case "${1:-}" in
  emulador) up_emulator ;;
  firebase) up_firebase ;;
  app) app ;;
  web) web ;;
  status) "${compose[@]}" -f deploy/compose.yaml ps ;;
  logs) "${compose[@]}" -f deploy/compose.yaml logs -f "${@:2}" ;;
  stop) "${compose[@]}" -f deploy/compose.yaml down ;;
  *)
    cat <<'USAGE'
Uso: ./dev.sh <comando>

Dois passos, em dois terminais:

  1. Suba o ambiente (escolha UM modo):
       ./dev.sh firebase   sua conta real do Firebase (projeto nupii-own)
       ./dev.sh emulador   contas de teste, que somem quando o container reinicia
  2. Abra o app:
       ./dev.sh app        emulador Android
       ./dev.sh web        navegador, em http://localhost:8081
     O app e a web usam sozinhos o modo do passo 1. Para trocar de modo,
     rode o passo 1 de novo com o outro modo e reinicie o passo 2.

Outros comandos:
  status     mostra o estado de cada serviço
  logs [s]   mostra o log dos serviços (ou só do serviço s, por exemplo api)
  stop       para tudo; os dados ficam nos volumes
USAGE
    ;;
esac
