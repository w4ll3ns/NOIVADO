#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Deploy do site do noivado em uma VPS (Ubuntu/Debian) via SSH + Docker.
#
#  Uso (no seu computador, dentro da pasta do projeto):
#     ./scripts/deploy.sh 'maby&chris'                 # alias do ~/.ssh/config
#     ./scripts/deploy.sh 'maby&chris' noivado.exemplo.com.br
#
#  Sem domínio, o site sobe em https://<ip-da-vps>.sslip.io (HTTPS real, grátis),
#  o que já permite testar a câmera do álbum no celular.
#
#  Variáveis opcionais: REMOTE_DIR (padrão ~/noivado), ADMIN_EMAIL,
#  SEED_DEMO=false (não criar convites de exemplo), APP_HOST_PORT (modo proxy).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HOST="${1:-}"
DOMAIN_ARG="${2:-}"
REMOTE_DIR="${REMOTE_DIR:-noivado}"
ADMIN_EMAIL_ARG="${ADMIN_EMAIL:-admin@noivado.local}"
SEED_DEMO_ARG="${SEED_DEMO:-true}"
APP_HOST_PORT_ARG="${APP_HOST_PORT:-3100}"

if [ -z "$HOST" ]; then
  echo "Uso: ./scripts/deploy.sh '<alias-ssh>' [dominio]" >&2
  exit 1
fi
cd "$(git rev-parse --show-toplevel)"

echo "▸ Testando SSH em $HOST…"
ssh -o BatchMode=yes -o ConnectTimeout=15 "$HOST" 'echo "  conectado em $(hostname)"'

if [ -n "$(git status --porcelain)" ]; then
  echo "  ⚠ Há alterações não commitadas — será enviado o último commit ($(git rev-parse --short HEAD))."
fi

echo "▸ Enviando o código ($(git rev-parse --short HEAD))…"
ssh "$HOST" "mkdir -p $REMOTE_DIR && cd $REMOTE_DIR && rm -rf src drizzle public scripts tests docs"
git archive --format=tar HEAD | ssh "$HOST" "tar -x -C $REMOTE_DIR"

echo "▸ Preparando o servidor…"
ssh "$HOST" bash -s -- "$REMOTE_DIR" "$DOMAIN_ARG" "$ADMIN_EMAIL_ARG" "$SEED_DEMO_ARG" "$APP_HOST_PORT_ARG" <<'REMOTE'
set -euo pipefail
DIR="$1"; DOMAIN_IN="$2"; ADMIN_EMAIL="$3"; SEED_DEMO="$4"; APP_HOST_PORT="$5"
cd "$DIR"
SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

if ! command -v docker >/dev/null 2>&1; then
  echo "  instalando Docker…"
  curl -fsSL https://get.docker.com | $SUDO sh
fi
DOCKER="docker"
if ! docker info >/dev/null 2>&1; then DOCKER="$SUDO docker"; fi
$DOCKER compose version >/dev/null

# Memória: o build do Next precisa de ~2 GB. Cria swap se a VPS for pequena.
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
SWAP_MB=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 2000 ] && [ "$SWAP_MB" -lt 1000 ]; then
  echo "  VPS com ${MEM_MB} MB de RAM: criando 2 GB de swap para o build…"
  $SUDO fallocate -l 2G /swapfile-noivado 2>/dev/null || $SUDO dd if=/dev/zero of=/swapfile-noivado bs=1M count=2048 status=none
  $SUDO chmod 600 /swapfile-noivado && $SUDO mkswap /swapfile-noivado >/dev/null && $SUDO swapon /swapfile-noivado
  grep -q swapfile-noivado /etc/fstab || echo '/swapfile-noivado none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
fi

setenv() { # setenv CHAVE valor  → substitui (mesmo comentada) ou acrescenta no .env
  if grep -qE "^#? ?$1=" .env; then sed -i -E "s|^#? ?$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
gen() { head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

FIRST_RUN=0
if [ ! -f .env ]; then
  FIRST_RUN=1
  IP=$(curl -fsS --max-time 8 https://api.ipify.org || hostname -I | awk '{print $1}')
  DOMAIN="${DOMAIN_IN:-$(echo "$IP" | tr . -).sslip.io}"
  ADMIN_PASSWORD="$(gen 16)"
  cp .env.example .env
  setenv DATABASE_URL "postgres://noivado:unused@db:5432/noivado"
  setenv APP_URL "https://$DOMAIN"
  setenv APP_SECRET "$(gen 48)"
  setenv NEXT_SERVER_ACTIONS_ENCRYPTION_KEY "$(head -c 32 /dev/urandom | base64)"
  setenv TRUST_PROXY true
  setenv DOMAIN "$DOMAIN"
  setenv POSTGRES_PASSWORD "$(gen 24)"
  setenv ADMIN_EMAIL "$ADMIN_EMAIL"
  setenv ADMIN_PASSWORD "$ADMIN_PASSWORD"
  setenv SEED_DEMO "$SEED_DEMO"
  setenv APP_HOST_PORT "$APP_HOST_PORT"
  chmod 600 .env
elif [ -n "$DOMAIN_IN" ]; then
  setenv APP_URL "https://$DOMAIN_IN"
  setenv DOMAIN "$DOMAIN_IN"
fi
DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d= -f2-)

# Portas 80/443 ocupadas por outro serviço (nginx, Apache…)? Usa o modo proxy.
COMPOSE="$DOCKER compose"
SERVICES=""
PORTS_BUSY=0
if command -v ss >/dev/null 2>&1 && $SUDO ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE ':(80|443)$'; then
  if ! $DOCKER ps --format '{{.Names}}' | grep -q caddy; then PORTS_BUSY=1; fi
fi
if [ "$PORTS_BUSY" = 1 ]; then
  echo "  ⚠ As portas 80/443 já estão em uso por outro serviço — subindo sem o Caddy."
  COMPOSE="$DOCKER compose -f docker-compose.yml -f docker-compose.proxy.yml"
  SERVICES="db setup app"
fi

if [ "$PORTS_BUSY" = 0 ] && command -v ufw >/dev/null 2>&1 && $SUDO ufw status 2>/dev/null | grep -q 'Status: active'; then
  $SUDO ufw allow 80/tcp >/dev/null && $SUDO ufw allow 443/tcp >/dev/null
fi

echo "  construindo e subindo os containers (a primeira vez leva alguns minutos)…"
$COMPOSE up -d --build $SERVICES

echo "  aguardando a aplicação…"
for i in $(seq 1 60); do
  if $COMPOSE exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

echo
echo "════════════════════════════════════════════════════════════"
if [ "$PORTS_BUSY" = 1 ]; then
  echo "  App rodando em 127.0.0.1:$APP_HOST_PORT. Aponte o seu proxy para lá, ex. (nginx):"
  echo "    server { server_name $DOMAIN; client_max_body_size 30M;"
  echo "             location / { proxy_pass http://127.0.0.1:$APP_HOST_PORT;"
  echo "               proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr;"
  echo "               proxy_set_header X-Forwarded-Proto \$scheme; } }"
else
  echo "  Site:   https://$DOMAIN"
fi
echo "  Painel: https://$DOMAIN/admin"
if [ "$FIRST_RUN" = 1 ]; then
  echo "  Login:  $ADMIN_EMAIL"
  echo "  Senha:  $ADMIN_PASSWORD   ← anote e troque em “Minha conta”"
fi
LINKS=$($COMPOSE logs setup 2>/dev/null | grep -o 'convite demo.*' || true)
if [ -n "$LINKS" ]; then
  echo "  Convites de exemplo:"
  echo "$LINKS" | sed 's/^/    /'
fi
echo "════════════════════════════════════════════════════════════"
REMOTE
