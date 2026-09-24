#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Instala ou atualiza o site do noivado NA PRÓPRIA VPS, com Docker.
#
#  Na VPS, a primeira vez:
#     git clone https://github.com/w4ll3ns/NOIVADO.git /opt/noivado
#     cd /opt/noivado && ./scripts/vps-setup.sh maby-chris.seudominio.com.br
#  Para atualizar depois (mantém banco, fotos e .env):
#     cd /opt/noivado && git pull && ./scripts/vps-setup.sh
#
#  Sem domínio, o site sobe em https://<ip-da-vps>.sslip.io.
#  O script vê o que já ocupa as portas 80/443 da VPS:
#    - nada ........................ sobe o Caddy deste projeto (HTTPS automático);
#    - Traefik em Docker (ex.: n8n)  registra o site nele, com o HTTPS do próprio Traefik;
#    - outro proxy (nginx, Caddy…)   app em 127.0.0.1:APP_HOST_PORT e mostra o que configurar.
#
#  Variáveis opcionais: ADMIN_EMAIL, SEED_DEMO=false (sem convites de exemplo),
#  APP_HOST_PORT (padrão 3100), SKIP_DNS_CHECK=1 (não conferir o DNS do domínio).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

DOMAIN_IN="${1:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@noivado.local}"
SEED_DEMO="${SEED_DEMO:-true}"
APP_HOST_PORT="${APP_HOST_PORT:-3100}"

# Aceita "https://dominio/" por engano e recusa caracteres inválidos (ex.: maby&chris).
DOMAIN_IN="${DOMAIN_IN#http://}"
DOMAIN_IN="${DOMAIN_IN#https://}"
DOMAIN_IN="${DOMAIN_IN%%/*}"
if [ -n "$DOMAIN_IN" ] && ! [[ "$DOMAIN_IN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]]; then
  echo "✗ Domínio inválido: '$DOMAIN_IN'. Use só letras, números, ponto e hífen — ex.: maby-chris.seudominio.com.br" >&2
  exit 1
fi

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
getenv() { grep -E "^$1=" .env | cut -d= -f2- || true; }
gen() { head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
public_ip() { curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}'; }

# O certificado HTTPS só sai se o domínio já apontar para esta VPS.
if [ -n "$DOMAIN_IN" ]; then DOMAIN_CHECK="$DOMAIN_IN"; elif [ -f .env ]; then DOMAIN_CHECK=$(getenv DOMAIN); else DOMAIN_CHECK=""; fi
case "$DOMAIN_CHECK" in ''|*.sslip.io|localhost) ;; *)
  if [ "${SKIP_DNS_CHECK:-}" != 1 ]; then
    MY_IP=$(public_ip)
    RESOLVED=$(getent ahostsv4 "$DOMAIN_CHECK" 2>/dev/null | awk '{print $1}' | sort -u || true)
    MATCH=0
    for ip in $MY_IP $(hostname -I 2>/dev/null); do
      if [ -n "$RESOLVED" ] && echo "$RESOLVED" | grep -Fx "$ip" >/dev/null; then MATCH=1; fi
    done
    if [ "$MATCH" = 0 ]; then
      echo "✗ O domínio $DOMAIN_CHECK ainda não aponta para esta VPS ($(echo ${RESOLVED:-sem registro no DNS}))." >&2
      echo "  No painel do domínio (ex.: cPanel → Zone Editor), crie um registro:" >&2
      echo "    Tipo: A   Nome: $DOMAIN_CHECK   Endereço: $MY_IP" >&2
      echo "  Espere alguns minutos e rode este comando de novo." >&2
      echo "  (Se o domínio usa o proxy da Cloudflare, rode com SKIP_DNS_CHECK=1 na frente.)" >&2
      exit 1
    fi
  fi ;;
esac

FIRST_RUN=0
if [ ! -f .env ]; then
  FIRST_RUN=1
  DOMAIN="$DOMAIN_IN"
  if [ -z "$DOMAIN" ]; then
    DOMAIN="$(public_ip | tr . -).sslip.io"
  fi
  cp .env.example .env
  setenv DATABASE_URL "postgres://noivado:unused@db:5432/noivado"
  setenv APP_URL "https://$DOMAIN"
  setenv APP_SECRET "$(gen 48)"
  setenv NEXT_SERVER_ACTIONS_ENCRYPTION_KEY "$(head -c 32 /dev/urandom | base64)"
  setenv TRUST_PROXY true
  setenv DOMAIN "$DOMAIN"
  setenv POSTGRES_PASSWORD "$(gen 24)"
  setenv ADMIN_EMAIL "$ADMIN_EMAIL"
  setenv ADMIN_PASSWORD "$(gen 16)"
  setenv SEED_DEMO "$SEED_DEMO"
  setenv APP_HOST_PORT "$APP_HOST_PORT"
  chmod 600 .env
  # Marca para mostrar o login no fim, mesmo se esta execução falhar e for repetida.
  touch .env.primeiro-acesso
elif [ -n "$DOMAIN_IN" ]; then
  setenv APP_URL "https://$DOMAIN_IN"
  setenv DOMAIN "$DOMAIN_IN"
fi
DOMAIN=$(getenv DOMAIN)

port_busy() { # port_busy 80 → sucesso se algo já escuta nessa porta
  if command -v ss >/dev/null 2>&1; then
    $SUDO ss -ltnH 2>/dev/null | awk '{print $4}' | grep -E ":$1\$" >/dev/null
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
  fi
}

# Quem está nas portas 80/443? Só o Caddy *deste* projeto conta como "nosso".
MODE=caddy
COMPOSE="$DOCKER compose"
SERVICES=""
HOLDER=""
if [ -z "$($COMPOSE ps --status running -q caddy 2>/dev/null)" ] && { port_busy 80 || port_busy 443; }; then
  MODE=proxy
  HOLDER=$($DOCKER ps --filter publish=443 --format '{{.Names}}' | head -n1)
  [ -n "$HOLDER" ] || HOLDER=$($DOCKER ps --filter publish=80 --format '{{.Names}}' | head -n1)
fi

# Traefik em Docker (como o do n8n): lê a configuração dele e registra o site por labels.
if [ -n "$HOLDER" ] && case "$($DOCKER inspect -f '{{.Config.Image}}' "$HOLDER")" in *traefik*) true ;; *) false ;; esac; then
  T_ARGS=$($DOCKER inspect -f '{{range .Args}}{{println .}}{{end}}' "$HOLDER")
  T_RESOLVER=$(echo "$T_ARGS" | sed -nE 's/^--certificatesresolvers\.([^.=]+)\..*/\1/p' | head -n1)
  T_HTTPS=$(echo "$T_ARGS" | sed -nE 's/^--entrypoints\.([^.=]+)\.address=.*:443$/\1/p' | head -n1)
  T_HTTP=$(echo "$T_ARGS" | sed -nE 's/^--entrypoints\.([^.=]+)\.address=.*:80$/\1/p' | head -n1)
  T_NET=$(echo "$T_ARGS" | sed -nE 's/^--providers\.docker\.network=(.+)$/\1/p' | head -n1)
  [ -n "$T_NET" ] || T_NET=$($DOCKER inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$HOLDER" | head -n1)
  if echo "$T_ARGS" | grep -E '^--providers\.docker(=true)?$' >/dev/null && [ -n "$T_RESOLVER" ] && [ -n "$T_HTTPS" ] \
    && [ -n "$T_NET" ] && [ "$T_NET" != host ] && [ "$T_NET" != bridge ]; then
    MODE=traefik
    setenv TRAEFIK_NETWORK "$T_NET"
    setenv TRAEFIK_ENTRYPOINT "$T_HTTPS"
    setenv TRAEFIK_HTTP_ENTRYPOINT "${T_HTTP:-web}"
    setenv TRAEFIK_CERTRESOLVER "$T_RESOLVER"
    COMPOSE="$DOCKER compose -f docker-compose.yml -f docker-compose.traefik.yml"
    SERVICES="db setup app"
    echo "  ▸ Traefik encontrado (container \"$HOLDER\"): o site será publicado por ele."
  fi
fi

if [ "$MODE" = proxy ]; then
  echo "  ⚠ As portas 80/443 já estão em uso por outro serviço — subindo sem o Caddy."
  if [ "$FIRST_RUN" = 1 ]; then
    # Outro projeto pode já usar a porta padrão: pega a próxima livre.
    while port_busy "$APP_HOST_PORT"; do APP_HOST_PORT=$((APP_HOST_PORT + 1)); done
    setenv APP_HOST_PORT "$APP_HOST_PORT"
  fi
  APP_HOST_PORT=$(getenv APP_HOST_PORT)
  APP_HOST_PORT="${APP_HOST_PORT:-3100}"
  COMPOSE="$DOCKER compose -f docker-compose.yml -f docker-compose.proxy.yml"
  SERVICES="db setup app"
fi
if [ "$MODE" != caddy ]; then
  $COMPOSE rm -sf caddy >/dev/null 2>&1 || true
fi

if [ "$MODE" = caddy ]; then
  if command -v ufw >/dev/null 2>&1 && $SUDO ufw status 2>/dev/null | grep -q 'Status: active'; then
    $SUDO ufw allow 80/tcp >/dev/null && $SUDO ufw allow 443/tcp >/dev/null
  fi
  if command -v firewall-cmd >/dev/null 2>&1 && $SUDO firewall-cmd --state >/dev/null 2>&1; then
    $SUDO firewall-cmd --permanent --add-service=http --add-service=https >/dev/null && $SUDO firewall-cmd --reload >/dev/null
  fi
fi

echo "  construindo e subindo os containers (a primeira vez leva alguns minutos)…"
$COMPOSE up -d --build $SERVICES

echo "  aguardando a aplicação…"
# Espera o healthcheck do Docker (o Traefik só encaminha tráfego para containers "healthy").
APP_ID=$($COMPOSE ps -q app)
HEALTHY=0
for _ in $(seq 1 60); do
  if [ "$($DOCKER inspect -f '{{.State.Health.Status}}' "$APP_ID" 2>/dev/null)" = healthy ]; then
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
if [ "$MODE" = proxy ]; then
  echo "  App rodando em 127.0.0.1:$APP_HOST_PORT. Falta ligar $DOMAIN no proxy que já ocupa 80/443."
  if [ -n "$HOLDER" ]; then
    # O proxy é um container de outro projeto: ele não enxerga o 127.0.0.1 da VPS,
    # então entra na rede do noivado e fala direto com o container do app.
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
  if [ "$MODE" = traefik ]; then
    echo "          (o Traefik emite o certificado no primeiro acesso — pode levar ~1 minuto)"
  fi
fi
echo "  Painel: https://$DOMAIN/admin"
if [ -f .env.primeiro-acesso ]; then
  echo "  Login:  $(getenv ADMIN_EMAIL)"
  echo "  Senha:  $(getenv ADMIN_PASSWORD)   ← anote e troque no painel, em Minha conta"
  rm -f .env.primeiro-acesso
fi
LINKS=$($COMPOSE logs setup 2>/dev/null | grep -o 'convite demo.*' || true)
if [ -n "$LINKS" ]; then
  echo "  Convites de exemplo:"
  echo "$LINKS" | sed 's/^/    /'
fi
echo "════════════════════════════════════════════════════════════"
