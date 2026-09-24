#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Deploy do site do noivado em uma VPS (Ubuntu/Debian) via SSH + Docker.
#
#  Uso (no seu computador, dentro da pasta do projeto):
#     ./scripts/deploy.sh maby-chris                   # alias do ~/.ssh/config
#     ./scripts/deploy.sh maby-chris noivado.exemplo.com.br
#
#  Sem domínio, o site sobe em https://<ip-da-vps>.sslip.io (HTTPS real, grátis),
#  o que já permite testar a câmera do álbum no celular.
#
#  Se a VPS já tiver outro proxy nas portas 80/443 (nginx, Caddy de outro
#  projeto…), o app sobe só em 127.0.0.1:APP_HOST_PORT e o script mostra o
#  trecho de configuração a acrescentar nesse proxy.
#
#  Variáveis opcionais: REMOTE_DIR (padrão ~/noivado), ADMIN_EMAIL,
#  SEED_DEMO=false (não criar convites de exemplo), APP_HOST_PORT (modo proxy,
#  padrão 3100 ou a próxima porta livre).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HOST="${1:-}"
DOMAIN_ARG="${2:-}"
REMOTE_DIR="${REMOTE_DIR:-noivado}"
ADMIN_EMAIL_ARG="${ADMIN_EMAIL:-admin@noivado.local}"
SEED_DEMO_ARG="${SEED_DEMO:-true}"
APP_HOST_PORT_ARG="${APP_HOST_PORT:-3100}"

if [ -z "$HOST" ]; then
  echo "Uso: ./scripts/deploy.sh <alias-ssh> [dominio]" >&2
  exit 1
fi
# O OpenSSH 9.6+ recusa nomes de host com & ; ' " $ ( ) etc., mesmo definidos no ~/.ssh/config.
case "$HOST" in
  *[\&\;\'\"\`\$\\\<\>\|\(\)\{\}\ ]*)
    echo "✗ O alias '$HOST' tem caracteres que o SSH não aceita (ex.: &)." >&2
    echo "  Use só letras, números, ponto, hífen ou _ — ex.: Host maby-chris no ~/.ssh/config." >&2
    exit 1 ;;
esac
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
  DOMAIN="$DOMAIN_IN"
  if [ -z "$DOMAIN" ]; then
    IP=$(curl -fsS --max-time 8 https://api.ipify.org || hostname -I | awk '{print $1}')
    DOMAIN="$(echo "$IP" | tr . -).sslip.io"
  fi
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
  # Marca para mostrar o login no fim, mesmo se esta execução falhar e for repetida.
  touch .env.primeiro-acesso
elif [ -n "$DOMAIN_IN" ]; then
  setenv APP_URL "https://$DOMAIN_IN"
  setenv DOMAIN "$DOMAIN_IN"
fi
DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d= -f2-)

port_busy() { # port_busy 80 → sucesso se algo já escuta nessa porta
  if command -v ss >/dev/null 2>&1; then
    $SUDO ss -ltnH 2>/dev/null | awk '{print $4}' | grep -E ":$1\$" >/dev/null
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
  fi
}

# Portas 80/443 ocupadas por outro serviço (nginx, Apache, o Caddy de outro projeto…)?
# Usa o modo proxy. Só o Caddy *deste* projeto conta como "nosso".
COMPOSE="$DOCKER compose"
SERVICES=""
PORTS_BUSY=0
if [ -z "$($COMPOSE ps --status running -q caddy 2>/dev/null)" ] && { port_busy 80 || port_busy 443; }; then
  PORTS_BUSY=1
fi
if [ "$PORTS_BUSY" = 1 ]; then
  echo "  ⚠ As portas 80/443 já estão em uso por outro serviço — subindo sem o Caddy."
  if [ "$FIRST_RUN" = 1 ]; then
    # Outro projeto pode já usar a porta padrão: pega a próxima livre.
    while port_busy "$APP_HOST_PORT"; do APP_HOST_PORT=$((APP_HOST_PORT + 1)); done
    setenv APP_HOST_PORT "$APP_HOST_PORT"
  fi
  APP_HOST_PORT=$(grep -E '^APP_HOST_PORT=' .env | cut -d= -f2- || true)
  APP_HOST_PORT="${APP_HOST_PORT:-3100}"
  COMPOSE="$DOCKER compose -f docker-compose.yml -f docker-compose.proxy.yml"
  SERVICES="db setup app"
  $COMPOSE rm -sf caddy >/dev/null 2>&1 || true
fi

if [ "$PORTS_BUSY" = 0 ] && command -v ufw >/dev/null 2>&1 && $SUDO ufw status 2>/dev/null | grep -q 'Status: active'; then
  $SUDO ufw allow 80/tcp >/dev/null && $SUDO ufw allow 443/tcp >/dev/null
fi

echo "  construindo e subindo os containers (a primeira vez leva alguns minutos)…"
$COMPOSE up -d --build $SERVICES

echo "  aguardando a aplicação…"
HEALTHY=0
for i in $(seq 1 60); do
  if $COMPOSE exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  sleep 3
done
if [ "$HEALTHY" = 0 ]; then
  echo "✗ A aplicação não respondeu em 3 minutos. Últimos logs:" >&2
  $COMPOSE logs --tail 40 setup app >&2 || true
  exit 1
fi

echo
echo "════════════════════════════════════════════════════════════"
if [ "$PORTS_BUSY" = 1 ]; then
  HOLDER=$($DOCKER ps --filter publish=443 --format '{{.Names}}' | head -n1)
  [ -n "$HOLDER" ] || HOLDER=$($DOCKER ps --filter publish=80 --format '{{.Names}}' | head -n1)
  echo "  App rodando em 127.0.0.1:$APP_HOST_PORT. Falta ligar $DOMAIN no proxy que já ocupa 80/443."
  if [ -n "$HOLDER" ]; then
    # O proxy é um container de outro projeto: ele não enxerga o 127.0.0.1 da VPS,
    # então entra na rede do noivado e fala direto com o container do app.
    APP_ID=$($COMPOSE ps -q app)
    APP_CTR=$($DOCKER inspect -f '{{.Name}}' "$APP_ID" | sed 's|^/||')
    APP_NET=$($DOCKER inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$APP_ID" | awk '{print $1}')
    echo "  Proxy atual: container \"$HOLDER\". Para publicar o noivado nele:"
    echo "    1) docker network connect $APP_NET $HOLDER"
    if echo "$HOLDER" | grep -qi caddy; then
      echo "    2) acrescente ao Caddyfile desse projeto:"
      echo "         $DOMAIN {"
      echo "           encode zstd gzip"
      echo "           request_body {"
      echo "             max_size 30MB"
      echo "           }"
      echo "           reverse_proxy $APP_CTR:3000"
      echo "         }"
      echo "    3) docker exec $HOLDER caddy reload --config /etc/caddy/Caddyfile"
    else
      echo "    2) aponte $DOMAIN para http://$APP_CTR:3000 (uploads de até 30 MB)"
    fi
    echo "  (se aquele projeto for recriado, repita o passo 1 ou declare a rede $APP_NET como external no compose dele)"
  else
    echo "  Exemplo para nginx — /etc/nginx/sites-available/noivado:"
    echo "    server {"
    echo "      listen 80;"
    echo "      server_name $DOMAIN;"
    echo "      client_max_body_size 30M;"
    echo "      location / {"
    echo "        proxy_pass http://127.0.0.1:$APP_HOST_PORT;"
    echo "        proxy_set_header Host \$host;"
    echo "        proxy_set_header X-Forwarded-For \$remote_addr;"
    echo "        proxy_set_header X-Forwarded-Proto \$scheme;"
    echo "      }"
    echo "    }"
    echo "  depois: ln -s /etc/nginx/sites-available/noivado /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"
    echo "          certbot --nginx -d $DOMAIN      # HTTPS"
  fi
else
  echo "  Site:   https://$DOMAIN"
fi
echo "  Painel: https://$DOMAIN/admin"
if [ -f .env.primeiro-acesso ]; then
  echo "  Login:  $(grep -E '^ADMIN_EMAIL=' .env | cut -d= -f2-)"
  echo "  Senha:  $(grep -E '^ADMIN_PASSWORD=' .env | cut -d= -f2-)   ← anote e troque em “Minha conta”"
  rm -f .env.primeiro-acesso
fi
LINKS=$($COMPOSE logs setup 2>/dev/null | grep -o 'convite demo.*' || true)
if [ -n "$LINKS" ]; then
  echo "  Convites de exemplo:"
  echo "$LINKS" | sed 's/^/    /'
fi
echo "════════════════════════════════════════════════════════════"
REMOTE
