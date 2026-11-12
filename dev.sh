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
# a "go run" of the API) gets part of the requests.
check_port() {
  local other
  # lsof ends with 1 when no program uses the port; that is the good case.
  other=$( (lsof -nP -iTCP:8080 -sTCP:LISTEN 2>/dev/null || true) | awk 'NR > 1 && $1 !~ /^com\.docke|^docker|^vpnkit/ {print $1 " (PID " $2 ")"}' | head -1)
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

# The app and the API must use the same Firebase: the emulator or the real project.
check_app_mode() {
  local mode=$1 emulator
  emulator=$(env_value mobile/.env EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL)
  if [[ $mode == emulador && -z $emulator ]]; then
    echo "Aviso: mobile/.env usa o projeto real do Firebase, e a API usa o emulador."
    echo "       O login do app não vai funcionar. Use ./dev.sh firebase, ou o mobile/.env.example."
  elif [[ $mode == firebase && -n $emulator ]]; then
    echo "Aviso: mobile/.env usa o emulador do Firebase, e a API usa o projeto real."
    echo "       Esvazie EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL e use a configuração do projeto real."
  fi
}

up_emulator() {
  check_common
  "${compose[@]}" -f deploy/compose.yaml up -d --build --wait
  check_app_mode emulador
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
  check_app_mode firebase
  done_message firebase
}

done_message() {
  echo
  echo "Ambiente no modo $1. API: http://localhost:8080/v1/health"
  echo "Para abrir o app no emulador Android: ./dev.sh app"
}

# The Android emulator (if no device is connected) and the Expo server.
app() {
  local sdk=${ANDROID_HOME:-$HOME/Library/Android/sdk}
  export PATH="$PATH:$sdk/emulator:$sdk/platform-tools"
  if ! adb devices | grep -q 'device$'; then
    local avd=${AVD:-$(emulator -list-avds | head -1)}
    [[ -n $avd ]] || fail "nenhum emulador Android criado. Crie um no Android Studio (Device Manager)."
    echo "Abrindo o emulador $avd..."
    emulator -avd "$avd" >/dev/null 2>&1 &
    adb wait-for-device
  fi
  cd mobile
  [[ -d node_modules ]] || npm install
  # Without CI=1: CI=1 turns off the file watching of Metro.
  unset CI
  exec npx expo start --port "${EXPO_PORT:-8099}" --android
}

# The public web (/card, /reports, /found) in the browser of this machine, at
# localhost:8081: the address of the links that the app makes. The browser
# reaches the API and the Authentication emulator at localhost, not at the
# address of the Android emulator (10.0.2.2), so this run changes them.
web() {
  cd mobile
  [[ -d node_modules ]] || npm install
  unset CI
  export EXPO_PUBLIC_API_URL=http://localhost:8080 EXPO_PUBLIC_WEB_URL=http://localhost:8081
  local emulator
  emulator=$(env_value .env EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL)
  if [[ -n $emulator ]]; then
    export EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL=${emulator//10.0.2.2/localhost}
  fi
  exec npx expo start --web --port 8081
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

  emulador   sobe a API, o banco, o S3, a inferência e o emulador do Firebase Authentication
  firebase   sobe o mesmo ambiente, com a API no projeto real do Firebase (backend/.env)
  app        abre o emulador Android e o app no Expo
  web        abre a web pública (carteirinha, mural, achei) em http://localhost:8081
  status     mostra o estado de cada serviço
  logs [s]   mostra o log dos serviços (ou só do serviço s, por exemplo api)
  stop       para tudo; os dados ficam nos volumes
USAGE
    ;;
esac
